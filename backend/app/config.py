import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./wedding.db")

IS_DEV = os.getenv("DEV_MODE", "true").lower() == "true"

ADMIN_SECRET = os.getenv("ADMIN_SECRET")

TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY")
TURNSTILE_EXPECTED_HOSTNAME = os.getenv("TURNSTILE_EXPECTED_HOSTNAME")
RSVP_RATE_LIMIT_SECRET = os.getenv("RSVP_RATE_LIMIT_SECRET")

RSVP_NOTIFICATION_EMAILS = [
    email.strip()
    for email in os.getenv("RSVP_NOTIFICATION_EMAILS", "").split(",")
    if email.strip()
]
RSVP_NOTIFICATION_FROM_EMAIL = os.getenv("RSVP_NOTIFICATION_FROM_EMAIL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RSVP_ADMIN_URL = os.getenv("RSVP_ADMIN_URL")
WEDDING_WEBSITE_URL = os.getenv("WEDDING_WEBSITE_URL")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
