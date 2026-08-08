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

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
