import hashlib
import hmac
import json
from datetime import datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as URLRequest, urlopen

from fastapi import HTTPException, Request
from sqlalchemy import delete, func
from sqlmodel import Session, select

from . import config
from .models import RSVPRateLimitEvent, utcnow


TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
RATE_LIMIT_WINDOW = timedelta(minutes=15)
RATE_LIMIT_WINDOW_MAX = 10
RATE_LIMIT_DAY = timedelta(days=1)
RATE_LIMIT_DAY_MAX = 30


def get_client_ip(request: Request) -> str:
    for header_name in ("cf-connecting-ip", "x-forwarded-for"):
        value = request.headers.get(header_name)
        if value:
            return value.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def fingerprint_client(client_ip: str) -> str:
    secret = config.RSVP_RATE_LIMIT_SECRET
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="RSVP submissions are temporarily unavailable.",
        )
    return hmac.new(
        secret.encode("utf-8"),
        client_ip.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def record_rate_limit_event(
    session: Session,
    client_fingerprint: str,
    now: datetime | None = None,
) -> None:
    current_time = now or utcnow()
    window_start = current_time - RATE_LIMIT_WINDOW
    day_start = current_time - RATE_LIMIT_DAY

    recent_count = session.exec(
        select(func.count())
        .select_from(RSVPRateLimitEvent)
        .where(
            RSVPRateLimitEvent.client_fingerprint == client_fingerprint,
            RSVPRateLimitEvent.created_at >= window_start,
        )
    ).one()
    daily_count = session.exec(
        select(func.count())
        .select_from(RSVPRateLimitEvent)
        .where(
            RSVPRateLimitEvent.client_fingerprint == client_fingerprint,
            RSVPRateLimitEvent.created_at >= day_start,
        )
    ).one()

    if recent_count >= RATE_LIMIT_WINDOW_MAX or daily_count >= RATE_LIMIT_DAY_MAX:
        raise HTTPException(
            status_code=429,
            detail="Too many RSVP attempts. Please wait and try again.",
        )

    session.add(
        RSVPRateLimitEvent(
            client_fingerprint=client_fingerprint,
            created_at=current_time,
        )
    )
    session.exec(
        delete(RSVPRateLimitEvent).where(RSVPRateLimitEvent.created_at < day_start)
    )
    session.commit()


def verify_turnstile(challenge_token: str, client_ip: str) -> bool:
    secret = config.TURNSTILE_SECRET_KEY
    if not secret:
        return False

    request_body = urlencode(
        {
            "secret": secret,
            "response": challenge_token,
            "remoteip": client_ip,
        }
    ).encode("utf-8")
    request = URLRequest(
        TURNSTILE_VERIFY_URL,
        data=request_body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return False

    if not isinstance(result, dict):
        return False
    if not result.get("success") or result.get("action") != "rsvp":
        return False

    expected_hostname = config.TURNSTILE_EXPECTED_HOSTNAME
    if expected_hostname and result.get("hostname") != expected_hostname:
        return False

    return True
