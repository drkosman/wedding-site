import json
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

from app import config, rsvp_notifications
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
        self.original_notification_emails = config.RSVP_NOTIFICATION_EMAILS
        self.original_notification_from_email = config.RSVP_NOTIFICATION_FROM_EMAIL
        self.original_resend_api_key = config.RESEND_API_KEY
        self.original_admin_url = config.RSVP_ADMIN_URL
        config.RSVP_RATE_LIMIT_SECRET = "test-rate-limit-secret"
        config.RSVP_NOTIFICATION_EMAILS = []
        config.RSVP_NOTIFICATION_FROM_EMAIL = None
        config.RESEND_API_KEY = None
        config.RSVP_ADMIN_URL = None

    def tearDown(self):
        config.RSVP_RATE_LIMIT_SECRET = self.original_rate_secret
        config.RSVP_NOTIFICATION_EMAILS = self.original_notification_emails
        config.RSVP_NOTIFICATION_FROM_EMAIL = self.original_notification_from_email
        config.RESEND_API_KEY = self.original_resend_api_key
        config.RSVP_ADMIN_URL = self.original_admin_url

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
        config.RSVP_NOTIFICATION_EMAILS = ["lucy@example.com", "kosta@example.com"]
        config.RSVP_NOTIFICATION_FROM_EMAIL = "Wedding RSVP <rsvp@example.com>"
        config.RESEND_API_KEY = "server-side-test-key"
        with patch.object(rsvp_notifications, "urlopen") as send_email:
            self.submit(valid_payload(), ip="203.0.113.21")
            self.submit(valid_payload(message="A corrected response"), ip="203.0.113.21")

        with Session(self.engine) as session:
            stored = session.exec(select(RSVP)).all()
        self.assertEqual(len(stored), 2)
        self.assertEqual(send_email.call_count, 2)
        subjects = [
            json.loads(call.args[0].data)["subject"]
            for call in send_email.call_args_list
        ]
        self.assertEqual(subjects, ["New RSVP — Test Guest", "New RSVP — Test Guest"])

    def test_successful_submission_sends_concise_notification_to_configured_recipients(self):
        config.RSVP_NOTIFICATION_EMAILS = ["lucy@example.com", "kosta@example.com"]
        config.RSVP_NOTIFICATION_FROM_EMAIL = "Wedding RSVP <rsvp@example.com>"
        config.RESEND_API_KEY = "server-side-test-key"
        config.RSVP_ADMIN_URL = "https://wedding.example/admin"

        with patch.object(rsvp_notifications, "urlopen") as send_email:
            response = self.submit(valid_payload())

        request = send_email.call_args.args[0]
        email = json.loads(request.data)
        self.assertEqual(response, {"status": "success"})
        self.assertEqual(email["to"], ["lucy@example.com", "kosta@example.com"])
        self.assertEqual(email["from"], "Wedding RSVP <rsvp@example.com>")
        self.assertEqual(email["subject"], "New RSVP — Test Guest")
        self.assertIn("Name: Test Guest", email["text"])
        self.assertIn("Attending: Yes", email["text"])
        self.assertIn("Number of guests: 2", email["text"])
        self.assertIn("Accommodation requested: Yes", email["text"])
        self.assertRegex(
            email["text"],
            r"Submitted: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z",
        )
        self.assertIn("https://wedding.example/admin", email["text"])
        self.assertNotIn("guest@example.com", email["text"])
        self.assertNotIn("Vegetarian", email["text"])
        self.assertNotIn("Cannot wait", email["text"])
        self.assertEqual(request.get_header("Authorization"), "Bearer server-side-test-key")
        self.assertEqual(request.get_header("Idempotency-key"), "new-rsvp/1")
        self.assertNotIn("server-side-test-key", request.data.decode("utf-8"))
        self.assertEqual(send_email.call_args.kwargs["timeout"], 5)

    def test_notification_failure_does_not_fail_or_roll_back_rsvp(self):
        config.RSVP_NOTIFICATION_EMAILS = ["admin@example.com"]
        config.RSVP_NOTIFICATION_FROM_EMAIL = "rsvp@example.com"
        config.RESEND_API_KEY = "server-side-test-key"

        with patch.object(
            rsvp_router,
            "notify_new_rsvp",
            side_effect=rsvp_notifications.EmailDeliveryError("provider details"),
        ), patch.object(rsvp_router.logger, "error") as log_error:
            response = self.submit(valid_payload())

        with Session(self.engine) as session:
            stored = session.exec(select(RSVP)).all()
        self.assertEqual(response, {"status": "success"})
        self.assertEqual(len(stored), 1)
        self.assertEqual(log_error.call_count, 1)
        self.assertNotIn("provider details", str(log_error.call_args))

    def test_notifications_are_disabled_without_recipients(self):
        config.RSVP_NOTIFICATION_EMAILS = []
        config.RSVP_NOTIFICATION_FROM_EMAIL = "rsvp@example.com"
        config.RESEND_API_KEY = "server-side-test-key"

        with patch.object(rsvp_notifications, "urlopen") as send_email:
            response = self.submit(valid_payload())

        self.assertEqual(response, {"status": "success"})
        send_email.assert_not_called()

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
