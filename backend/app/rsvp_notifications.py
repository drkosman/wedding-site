import json
from datetime import timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from . import config
from .models import RSVP


RESEND_EMAILS_URL = "https://api.resend.com/emails"
EMAIL_TIMEOUT_SECONDS = 5


class NotificationConfigurationError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


def _format_timestamp(rsvp: RSVP) -> str:
    submitted_at = rsvp.created_at
    if submitted_at.tzinfo is None:
        submitted_at = submitted_at.replace(tzinfo=timezone.utc)
    else:
        submitted_at = submitted_at.astimezone(timezone.utc)
    return submitted_at.isoformat(timespec="seconds").replace("+00:00", "Z")


def _notification_text(rsvp: RSVP) -> str:
    lines = [
        "A new RSVP has been submitted.",
        "",
        f"Name: {rsvp.submitted_name}",
        f"Attending: {'Yes' if rsvp.attending else 'No'}",
        f"Number of guests: {rsvp.guest_count}",
    ]
    if rsvp.attending:
        lines.append(
            "Accommodation requested: "
            f"{'Yes' if rsvp.hotel_reservation_requested else 'No'}"
        )
    lines.append(f"Submitted: {_format_timestamp(rsvp)}")

    admin_url = (config.RSVP_ADMIN_URL or "").strip()
    if admin_url:
        lines.extend(["", f"Review the full RSVP: {admin_url}"])

    return "\n".join(lines)


def _send_resend_email(rsvp: RSVP, recipients: list[str], sender: str, api_key: str) -> None:
    if rsvp.id is None:
        raise EmailDeliveryError("RSVP must be persisted before notification")

    request = Request(
        RESEND_EMAILS_URL,
        data=json.dumps(
            {
                "from": sender,
                "to": recipients,
                "subject": f"New RSVP — {rsvp.submitted_name}",
                "text": _notification_text(rsvp),
            }
        ).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Idempotency-Key": f"new-rsvp/{rsvp.id}",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=EMAIL_TIMEOUT_SECONDS):
            pass
    except (HTTPError, URLError, TimeoutError) as error:
        raise EmailDeliveryError("Email provider request failed") from error


def notify_new_rsvp(rsvp: RSVP) -> bool:
    """Send one concise admin notification, or return False when notifications are off."""

    recipients = config.RSVP_NOTIFICATION_EMAILS
    if not recipients:
        return False

    sender = (config.RSVP_NOTIFICATION_FROM_EMAIL or "").strip()
    api_key = (config.RESEND_API_KEY or "").strip()
    if not sender or not api_key:
        raise NotificationConfigurationError(
            "RSVP notification sender and provider credentials are required"
        )

    _send_resend_email(rsvp, list(recipients), sender, api_key)
    return True
