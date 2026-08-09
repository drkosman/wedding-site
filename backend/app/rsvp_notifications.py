import json
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from . import config
from .models import RSVP


RESEND_EMAILS_URL = "https://api.resend.com/emails"
EMAIL_TIMEOUT_SECONDS = 5
SCENIC_IMAGE_PATH = "/email-assets/barnacarry-bay.jpg"
COUPLE_IMAGE_PATH = "/email-assets/lucy-and-kosta.jpg"


class NotificationConfigurationError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class EmailMessage:
    recipients: tuple[str, ...]
    subject: str
    text: str
    idempotency_key: str
    html: str | None = None


def _format_timestamp(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def _idempotency_timestamp(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.strftime("%Y%m%dT%H%M%S%fZ")


def _delivery_credentials() -> tuple[str, str] | None:
    sender = (config.RSVP_NOTIFICATION_FROM_EMAIL or "").strip()
    api_key = (config.RESEND_API_KEY or "").strip()
    if not sender and not api_key:
        return None
    if not sender or not api_key:
        raise NotificationConfigurationError(
            "RSVP notification sender and provider credentials must be configured together"
        )
    return sender, api_key


def _website_url() -> str:
    website_url = (config.WEDDING_WEBSITE_URL or "").strip().rstrip("/")
    parsed = urlparse(website_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise NotificationConfigurationError(
            "A valid WEDDING_WEBSITE_URL is required for RSVP confirmations"
        )
    return website_url


def _send_resend_email(message: EmailMessage, sender: str, api_key: str) -> None:
    payload: dict[str, object] = {
        "from": sender,
        "to": list(message.recipients),
        "subject": message.subject,
        "text": message.text,
    }
    if message.html:
        payload["html"] = message.html

    request = Request(
        RESEND_EMAILS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotency_key,
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=EMAIL_TIMEOUT_SECONDS):
            pass
    except (HTTPError, URLError, TimeoutError) as error:
        raise EmailDeliveryError("Email provider request failed") from error


def _admin_notification(rsvp: RSVP) -> EmailMessage:
    lines = [
        "A new RSVP has been submitted.",
        "",
        f"Name: {rsvp.submitted_name}",
        f"Attending: {'Yes' if rsvp.attending else 'No'}",
    ]
    lines.append(f"Submitted: {_format_timestamp(rsvp.created_at)}")

    admin_url = (config.RSVP_ADMIN_URL or "").strip()
    if admin_url:
        lines.extend(["", f"Review the full RSVP: {admin_url}"])

    if rsvp.id is None:
        raise EmailDeliveryError("RSVP must be persisted before notification")
    return EmailMessage(
        recipients=tuple(config.RSVP_NOTIFICATION_EMAILS),
        subject=f"New RSVP — {rsvp.submitted_name}",
        text="\n".join(lines),
        idempotency_key=f"new-rsvp/{rsvp.id}",
    )


def notify_new_rsvp(rsvp: RSVP) -> bool:
    """Send the concise wedding-admin notification for a new public submission."""

    if not config.RSVP_NOTIFICATION_EMAILS:
        return False
    credentials = _delivery_credentials()
    if not credentials:
        raise NotificationConfigurationError(
            "RSVP notification sender and provider credentials are required"
        )
    _send_resend_email(_admin_notification(rsvp), *credentials)
    return True


def _confirmation_rows(rsvp: RSVP) -> list[tuple[str, str]]:
    rows = [("Attendance", "Attending" if rsvp.attending else "Not attending")]
    if not rsvp.attending:
        if rsvp.message:
            rows.append(("Your comment", rsvp.message))
        return rows

    rows.append(("Sunday attendance", "Yes" if rsvp.sunday_event else "No"))
    if rsvp.dietaries:
        rows.append(("Your dietary requirements", rsvp.dietaries))
    if rsvp.message:
        rows.append(("Your comment", rsvp.message))
    return rows


def _html_text(value: str) -> str:
    return escape(value, quote=True).replace("\r\n", "\n").replace("\r", "\n").replace(
        "\n", "<br>"
    )


def _summary_html(rows: list[tuple[str, str]]) -> str:
    rendered_rows = []
    for label, value in rows:
        rendered_rows.append(
            '<tr><td style="padding:16px 0;border-bottom:1px solid #dcebe8;">'
            '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;'
            'font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#00796b;">'
            f"{escape(label)}</div>"
            '<div style="padding-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:16px;'
            'line-height:24px;color:#183d3a;">'
            f"{_html_text(value)}</div></td></tr>"
        )
    return "".join(rendered_rows)


def _confirmation_html(rsvp: RSVP, updated: bool, website_url: str) -> str:
    guest_name = escape(rsvp.submitted_name)
    scenic_url = escape(f"{website_url}{SCENIC_IMAGE_PATH}", quote=True)
    couple_url = escape(f"{website_url}{COUPLE_IMAGE_PATH}", quote=True)
    safe_website_url = escape(website_url, quote=True)
    action_label = "RSVP updated" if updated else "RSVP received"
    heading = "Your RSVP has been updated" if updated else "We've received your RSVP"
    intro = (
        "Thanks for letting us know — we can't wait to celebrate with you."
        if rsvp.attending
        else (
            "Thanks for letting us know. We're sorry you won't be able to join us, "
            "but we really appreciate you replying."
        )
    )
    timestamp_label = "Updated" if updated else "Submitted"
    timestamp = _format_timestamp(rsvp.updated_at if updated else rsvp.created_at)

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>{escape(heading)} — Lucy &amp; Kosta</title>
  <style>
    @media only screen and (max-width: 620px) {{
      .email-container {{ width: 100% !important; }}
      .email-content {{ padding-left: 24px !important; padding-right: 24px !important; }}
      .couple-photo {{ width: 100% !important; max-width: 280px !important; height: auto !important; }}
      .mobile-heading {{ font-size: 28px !important; line-height: 34px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#c9d9e6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    {escape(heading)}. Your saved response is included below.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#c9d9e6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-container" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #a9bec7;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(24,61,58,0.10);">
          <tr>
            <td bgcolor="#183d3a" style="background-color:#183d3a;">
              <img src="{scenic_url}" width="600" height="300" alt="Barnacarry Bay" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:300px;text-align:center;">
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:30px 24px 22px;background-color:#f7fafb;border-bottom:1px solid #dcebe8;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:31px;line-height:38px;font-weight:700;color:#00695c;">Lucy &amp; Kosta</div>
              <div style="padding-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#4b615f;">1 May 2027 · Barnacarry Bay</div>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:38px 48px 18px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00796b;">{action_label}</div>
              <h1 class="mobile-heading" style="margin:8px 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:41px;font-weight:700;color:#00695c;">{escape(heading)}</h1>
              <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:27px;color:#183d3a;">Hi {guest_name},</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#4b615f;">{escape(intro)}</p>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:18px 48px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f7fafb;border:1px solid #a9bec7;border-radius:8px;">
                <tr><td style="padding:20px 22px 4px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;font-weight:700;color:#00695c;">Your RSVP summary</td></tr>
                <tr><td style="padding:0 22px 18px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">{_summary_html(_confirmation_rows(rsvp))}</table></td></tr>
              </table>
              <div style="padding-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#4b615f;">{timestamp_label}: {timestamp}</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="email-content" style="padding:4px 48px 30px;">
              <img src="{couple_url}" width="280" height="373" alt="Lucy and Kosta" class="couple-photo" style="display:block;width:280px;max-width:100%;height:auto;border:0;border-radius:8px;color:#4b615f;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;text-align:center;">
            </td>
          </tr>
          <tr>
            <td align="center" class="email-content" style="padding:0 48px 38px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#00796b" style="border-radius:6px;background-color:#00796b;"><a href="{safe_website_url}" style="display:inline-block;padding:14px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">Visit our wedding website</a></td></tr></table>
              <p style="margin:28px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:28px;color:#183d3a;">With love,<br>Lucy &amp; Kosta</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 24px;background-color:#dcebe8;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#4b615f;">This is a record of the RSVP saved for {guest_name}.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _confirmation_text(rsvp: RSVP, updated: bool, website_url: str) -> str:
    heading = "Your RSVP has been updated" if updated else "We've received your RSVP"
    intro = (
        "Thanks for letting us know — we can't wait to celebrate with you."
        if rsvp.attending
        else (
            "Thanks for letting us know. We're sorry you won't be able to join us, "
            "but we really appreciate you replying."
        )
    )
    rows = "\n".join(f"{label}: {value}" for label, value in _confirmation_rows(rsvp))
    timestamp_label = "Updated" if updated else "Submitted"
    timestamp = _format_timestamp(rsvp.updated_at if updated else rsvp.created_at)
    return (
        f"{heading} — Lucy & Kosta\n\n"
        f"Hi {rsvp.submitted_name},\n\n"
        f"{intro}\n\n"
        f"Your RSVP summary\n{rows}\n\n"
        f"{timestamp_label}: {timestamp}\n\n"
        f"Visit our wedding website: {website_url}\n\n"
        "With love,\nLucy & Kosta"
    )


def build_guest_confirmation(rsvp: RSVP, updated: bool = False) -> EmailMessage:
    if rsvp.id is None:
        raise EmailDeliveryError("RSVP must be persisted before confirmation")
    website_url = _website_url()
    subject = (
        "Your RSVP has been updated — Lucy & Kosta"
        if updated
        else "We've received your RSVP — Lucy & Kosta"
    )
    event_key = (
        f"updated/{_idempotency_timestamp(rsvp.updated_at)}" if updated else "received"
    )
    return EmailMessage(
        recipients=(rsvp.email,),
        subject=subject,
        text=_confirmation_text(rsvp, updated, website_url),
        html=_confirmation_html(rsvp, updated, website_url),
        idempotency_key=f"rsvp-confirmation/{rsvp.id}/{event_key}",
    )


def notify_guest_confirmation(rsvp: RSVP, updated: bool = False) -> bool:
    """Send the persisted RSVP back to its submitted contact address."""

    credentials = _delivery_credentials()
    if not credentials:
        return False
    _send_resend_email(build_guest_confirmation(rsvp, updated), *credentials)
    return True
