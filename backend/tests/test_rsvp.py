import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from fastapi.routing import APIRoute
from pydantic import ValidationError
from sqlmodel import Session, SQLModel, create_engine, select
from starlette.requests import Request

from app import config
from app.abuse import RATE_LIMIT_WINDOW_MAX, fingerprint_client, record_rate_limit_event
from app.models import PublicRSVPRequest, RSVP, RSVPRateLimitEvent
from app.routers import rsvp as rsvp_router


def request_from(ip: str = "203.0.113.20") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/rsvps",
            "headers": [],
            "client": (ip, 12345),
        }
    )


def valid_payload(**overrides) -> PublicRSVPRequest:
    values = {
        "full_name": "  Test   Guest  ",
        "email": "GUEST@Example.com ",
        "attending": True,
        "guest_count": 2,
        "additional_guest_names": "Second Guest",
        "sunday_event": True,
        "hotel_reservation_requested": True,
        "friday_night": True,
        "saturday_night": True,
        "dietaries": " Vegetarian ",
        "message": " Cannot wait ",
        "turnstile_token": "challenge-token",
    }
    values.update(overrides)
    return PublicRSVPRequest(**values)


class RSVPRouteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.original_rate_secret = config.RSVP_RATE_LIMIT_SECRET
        config.RSVP_RATE_LIMIT_SECRET = "test-rate-limit-secret"

    def tearDown(self):
        config.RSVP_RATE_LIMIT_SECRET = self.original_rate_secret

    def submit(self, payload: PublicRSVPRequest, ip: str = "203.0.113.20"):
        with Session(self.engine) as session:
            with patch.object(rsvp_router, "verify_turnstile", return_value=True):
                return rsvp_router.submit_rsvp(payload, request_from(ip), session)

    def test_public_route_requires_no_token_and_exposes_no_guest_lookup(self):
        paths = {
            (route.path, tuple(sorted(route.methods)))
            for route in rsvp_router.router.routes
            if isinstance(route, APIRoute)
        }
        self.assertIn(("/rsvps", ("POST",)), paths)
        self.assertFalse(any("token" in path or "/guest" in path for path, _ in paths))

    def test_valid_submission_is_normalized_and_persisted(self):
        response = self.submit(valid_payload())

        with Session(self.engine) as session:
            stored = session.exec(select(RSVP)).one()

        self.assertEqual(response, {"status": "success"})
        self.assertEqual(stored.submitted_name, "Test Guest")
        self.assertEqual(stored.email, "guest@example.com")
        self.assertEqual(stored.guest_count, 2)
        self.assertEqual(stored.additional_guest_names, "Second Guest")
        self.assertTrue(stored.sunday_event)
        self.assertTrue(stored.hotel_reservation_requested)
        self.assertEqual(stored.dietaries, "Vegetarian")
        self.assertIsNone(stored.guest_id)

    def test_declining_submission_clears_attendance_dependent_fields(self):
        payload = valid_payload(
            attending=False,
            guest_count=1,
            additional_guest_names=None,
            sunday_event=False,
            hotel_reservation_requested=False,
            friday_night=False,
            saturday_night=False,
            dietaries=None,
        )
        self.submit(payload)

        with Session(self.engine) as session:
            stored = session.exec(select(RSVP)).one()
        self.assertFalse(stored.attending)
        self.assertEqual(stored.guest_count, 1)
        self.assertFalse(stored.sunday_event)
        self.assertIsNone(stored.dietaries)

    def test_repeated_name_and_email_create_separate_submissions(self):
        self.submit(valid_payload(), ip="203.0.113.21")
        self.submit(valid_payload(message="A corrected response"), ip="203.0.113.21")

        with Session(self.engine) as session:
            stored = session.exec(select(RSVP)).all()
        self.assertEqual(len(stored), 2)

    def test_validation_requires_name_and_valid_email(self):
        with self.assertRaises(ValidationError):
            valid_payload(full_name=" ")
        with self.assertRaises(ValidationError):
            valid_payload(email="not-an-email")
        with self.assertRaises(ValidationError):
            valid_payload(email="guest..name@example.com")

    def test_guest_count_and_conditional_fields_are_validated(self):
        with self.assertRaises(ValidationError):
            valid_payload(guest_count=0)
        with self.assertRaises(ValidationError):
            valid_payload(guest_count=7)
        with self.assertRaises(ValidationError):
            valid_payload(guest_count=2, additional_guest_names="")
        with self.assertRaises(ValidationError):
            valid_payload(hotel_reservation_requested=False, friday_night=True)
        with self.assertRaises(ValidationError):
            valid_payload(
                attending=False,
                guest_count=2,
                sunday_event=True,
                hotel_reservation_requested=False,
                friday_night=False,
                saturday_night=False,
            )

    def test_bot_verification_failure_does_not_persist_rsvp(self):
        with Session(self.engine) as session:
            with patch.object(rsvp_router, "verify_turnstile", return_value=False):
                with self.assertRaises(HTTPException) as error:
                    rsvp_router.submit_rsvp(valid_payload(), request_from(), session)
            self.assertEqual(session.exec(select(RSVP)).all(), [])
            self.assertEqual(len(session.exec(select(RSVPRateLimitEvent)).all()), 1)
        self.assertEqual(error.exception.status_code, 400)

    def test_honeypot_submission_is_quietly_discarded(self):
        with Session(self.engine) as session:
            response = rsvp_router.submit_rsvp(
                valid_payload(website="https://spam.invalid"),
                request_from(),
                session,
            )
            self.assertEqual(response, {"status": "success"})
            self.assertEqual(session.exec(select(RSVP)).all(), [])
            self.assertEqual(session.exec(select(RSVPRateLimitEvent)).all(), [])

    def test_database_backed_rate_limit_rejects_excess_attempts(self):
        fingerprint = fingerprint_client("203.0.113.30")
        with Session(self.engine) as session:
            for _ in range(RATE_LIMIT_WINDOW_MAX):
                record_rate_limit_event(session, fingerprint)
            with self.assertRaises(HTTPException) as error:
                record_rate_limit_event(session, fingerprint)
        self.assertEqual(error.exception.status_code, 429)


if __name__ == "__main__":
    unittest.main()
