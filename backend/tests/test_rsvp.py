import io
import json
import socket
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

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
        self.original_website_url = config.WEDDING_WEBSITE_URL
        config.RSVP_RATE_LIMIT_SECRET = "test-rate-limit-secret"
        config.RSVP_NOTIFICATION_EMAILS = []
        config.RSVP_NOTIFICATION_FROM_EMAIL = None
        config.RESEND_API_KEY = None
        config.RSVP_ADMIN_URL = None
        config.WEDDING_WEBSITE_URL = None

    def tearDown(self):
        config.RSVP_RATE_LIMIT_SECRET = self.original_rate_secret
        config.RSVP_NOTIFICATION_EMAILS = self.original_notification_emails
        config.RSVP_NOTIFICATION_FROM_EMAIL = self.original_notification_from_email
        config.RESEND_API_KEY = self.original_resend_api_key
        config.RSVP_ADMIN_URL = self.original_admin_url
        config.WEDDING_WEBSITE_URL = self.original_website_url

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
        config.WEDDING_WEBSITE_URL = "https://wedding.example"
        with patch.object(rsvp_notifications, "urlopen") as send_email:
            self.submit(valid_payload(), ip="203.0.113.21")
            self.submit(valid_payload(message="A corrected response"), ip="203.0.113.21")

        with Session(self.engine) as session:
            stored = session.exec(select(RSVP)).all()
        self.assertEqual(len(stored), 2)
        self.assertEqual(send_email.call_count, 4)
        subjects = [
            json.loads(call.args[0].data)["subject"]
            for call in send_email.call_args_list
        ]
        self.assertEqual(subjects.count("New RSVP — Test Guest"), 2)
        self.assertEqual(subjects.count("We've received your RSVP — Lucy & Kosta"), 2)

    def test_successful_submission_sends_concise_notification_to_configured_recipients(self):
        config.RSVP_NOTIFICATION_EMAILS = ["lucy@example.com", "kosta@example.com"]
        config.RSVP_NOTIFICATION_FROM_EMAIL = "Wedding RSVP <rsvp@example.com>"
        config.RESEND_API_KEY = "server-side-test-key"
        config.RSVP_ADMIN_URL = "https://wedding.example/admin"
        config.WEDDING_WEBSITE_URL = "https://wedding.example"

        with patch.object(rsvp_notifications, "urlopen") as send_email:
            response = self.submit(valid_payload())

        request = next(
            call.args[0]
            for call in send_email.call_args_list
            if json.loads(call.args[0].data)["subject"] == "New RSVP — Test Guest"
        )
        email = json.loads(request.data)
        self.assertEqual(response, {"status": "success"})
        self.assertEqual(email["to"], ["lucy@example.com", "kosta@example.com"])
        self.assertEqual(email["from"], "Wedding RSVP <rsvp@example.com>")
        self.assertEqual(email["subject"], "New RSVP — Test Guest")
        self.assertIn("Name: Test Guest", email["text"])
        self.assertIn("Attending: Yes", email["text"])
        self.assertNotIn("Number of guests", email["text"])
        self.assertNotIn("Accommodation", email["text"])
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
        self.assertEqual(
            request.get_header("User-agent"), "lucy-and-kosta-wedding/1.0"
        )
        self.assertNotIn("server-side-test-key", request.data.decode("utf-8"))
        self.assertEqual(send_email.call_args.kwargs["timeout"], 5)

    def test_notification_failure_does_not_fail_or_roll_back_rsvp(self):
        config.RSVP_NOTIFICATION_EMAILS = ["admin@example.com"]
        config.RSVP_NOTIFICATION_FROM_EMAIL = "rsvp@example.com"
        config.RESEND_API_KEY = "server-side-test-key"
        config.WEDDING_WEBSITE_URL = "https://wedding.example"

        with patch.object(
            rsvp_router,
            "notify_new_rsvp",
            side_effect=rsvp_notifications.EmailDeliveryError("provider details"),
        ), patch.object(
            rsvp_router, "notify_guest_confirmation", return_value=True
        ), patch.object(rsvp_router.logger, "error") as log_error:
            response = self.submit(valid_payload())

        with Session(self.engine) as session:
            stored = session.exec(select(RSVP)).all()
        self.assertEqual(response, {"status": "success"})
        self.assertEqual(len(stored), 1)
        self.assertEqual(log_error.call_count, 1)
        self.assertNotIn("provider details", str(log_error.call_args))
        self.assertIn("delivery_error", str(log_error.call_args))

    def test_notifications_are_disabled_without_email_configuration(self):
        config.RSVP_NOTIFICATION_EMAILS = []

        with patch.object(rsvp_notifications, "urlopen") as send_email:
            response = self.submit(valid_payload())

        self.assertEqual(response, {"status": "success"})
        send_email.assert_not_called()

    def test_confirmation_failure_does_not_fail_or_roll_back_rsvp(self):
        config.RSVP_NOTIFICATION_EMAILS = []
        config.RSVP_NOTIFICATION_FROM_EMAIL = "rsvp@example.com"
        config.RESEND_API_KEY = "server-side-test-key"
        config.WEDDING_WEBSITE_URL = "https://wedding.example"

        with patch.object(
            rsvp_router,
            "notify_guest_confirmation",
            side_effect=rsvp_notifications.EmailDeliveryError("provider details"),
        ), patch.object(rsvp_router.logger, "error") as log_error:
            response = self.submit(valid_payload())

        with Session(self.engine) as session:
            stored = session.exec(select(RSVP)).all()
        self.assertEqual(response, {"status": "success"})
        self.assertEqual(len(stored), 1)
        self.assertEqual(log_error.call_count, 1)
        self.assertNotIn("provider details", str(log_error.call_args))
        self.assertIn("delivery_error", str(log_error.call_args))

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


class RSVPConfirmationTests(unittest.TestCase):
    def setUp(self):
        self.original_website_url = config.WEDDING_WEBSITE_URL
        self.original_from_email = config.RSVP_NOTIFICATION_FROM_EMAIL
        self.original_resend_api_key = config.RESEND_API_KEY
        config.WEDDING_WEBSITE_URL = "https://wedding.example"
        config.RSVP_NOTIFICATION_FROM_EMAIL = "Wedding RSVP <rsvp@example.com>"
        config.RESEND_API_KEY = "server-side-test-key"

    def tearDown(self):
        config.WEDDING_WEBSITE_URL = self.original_website_url
        config.RSVP_NOTIFICATION_FROM_EMAIL = self.original_from_email
        config.RESEND_API_KEY = self.original_resend_api_key

    def rsvp(self, **overrides) -> RSVP:
        values = {
            "id": 42,
            "submitted_name": "Test Guest",
            "email": "guest@example.com",
            "attending": True,
            "guest_count": 1,
            "created_at": datetime(2026, 8, 9, 12, 30, 15, 123456),
            "updated_at": datetime(2026, 8, 10, 14, 45, 30, 654321),
        }
        values.update(overrides)
        return RSVP(**values)

    def test_attending_confirmation_contains_applicable_persisted_summary(self):
        rsvp = self.rsvp(
            submitted_name="Jamie & Morgan",
            guest_count=3,
            additional_guest_names="Alex <Guest>\nJo & Guest",
            sunday_event=True,
            hotel_reservation_requested=True,
            friday_night=True,
            sunday_night=True,
            dietaries='<script>alert("dietary")</script>\nNut & dairy allergy',
            message='<img src=x onerror="alert(1)">\nCan\'t wait & see you!',
        )

        message = rsvp_notifications.build_guest_confirmation(rsvp)

        self.assertEqual(message.recipients, ("guest@example.com",))
        self.assertEqual(message.subject, "We've received your RSVP — Lucy & Kosta")
        self.assertIn("Attendance: Attending", message.text)
        self.assertIn("Sunday attendance: Yes", message.text)
        self.assertNotIn("Number attending", message.text)
        self.assertNotIn("Additional guests", message.text)
        self.assertNotIn("Accommodation", message.text)
        self.assertNotIn("Requested nights", message.text)
        self.assertIn("Your dietary requirements:", message.text)
        self.assertIn("Your comment:", message.text)
        self.assertIn("https://wedding.example", message.text)

        self.assertIsNotNone(message.html)
        html = message.html or ""
        self.assertIn("https://wedding.example/email-assets/barnacarry-bay.jpg", html)
        self.assertIn("https://wedding.example/email-assets/lucy-and-kosta.jpg", html)
        self.assertIn('alt="Barnacarry Bay"', html)
        self.assertIn('alt="Lucy and Kosta"', html)
        self.assertIn("Jamie &amp; Morgan", html)
        self.assertNotIn("Alex &lt;Guest&gt;", html)
        self.assertIn("&lt;script&gt;alert(&quot;dietary&quot;)&lt;/script&gt;", html)
        self.assertIn("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;<br>", html)
        self.assertNotIn("<script>alert", html)
        self.assertNotIn("<img src=x", html)

    def test_declining_confirmation_omits_attendance_dependent_fields(self):
        message = rsvp_notifications.build_guest_confirmation(
            self.rsvp(
                attending=False,
                message="We will be thinking of you.",
            )
        )

        self.assertIn("Attendance: Not attending", message.text)
        self.assertIn("Your comment: We will be thinking of you.", message.text)
        self.assertIn("sorry you won't be able to join us", message.text)
        self.assertNotIn("Number attending", message.text)
        self.assertNotIn("Sunday attendance", message.text)
        self.assertNotIn("Accommodation", message.text)
        self.assertNotIn("dietary", message.text.lower())
        self.assertIn("sorry you won&#x27;t be able to join us", message.html or "")

    def test_absent_optional_values_are_cleanly_omitted(self):
        message = rsvp_notifications.build_guest_confirmation(
            self.rsvp(sunday_event=False)
        )

        self.assertIn("Sunday attendance: No", message.text)
        self.assertNotIn("Additional guests", message.text)
        self.assertNotIn("Accommodation help", message.text)
        self.assertNotIn("Your dietary requirements", message.text)
        self.assertNotIn("Your comment", message.text)

    def test_updated_confirmation_uses_updated_subject_content_and_version(self):
        rsvp = self.rsvp(message="Latest persisted comment")

        received = rsvp_notifications.build_guest_confirmation(rsvp)
        updated = rsvp_notifications.build_guest_confirmation(rsvp, updated=True)

        self.assertEqual(updated.subject, "Your RSVP has been updated — Lucy & Kosta")
        self.assertIn("Your RSVP has been updated", updated.text)
        self.assertIn("Updated: 2026-08-10T14:45:30Z", updated.text)
        self.assertIn("RSVP updated", updated.html or "")
        self.assertIn("Latest persisted comment", updated.text)
        self.assertNotEqual(updated.idempotency_key, received.idempotency_key)
        self.assertIn("20260810T144530654321Z", updated.idempotency_key)

    def test_confirmation_provider_payload_has_html_text_and_guest_recipient(self):
        with patch.object(rsvp_notifications, "urlopen") as send_email:
            sent = rsvp_notifications.notify_guest_confirmation(self.rsvp())

        request = send_email.call_args.args[0]
        payload = json.loads(request.data)
        self.assertTrue(sent)
        self.assertEqual(payload["to"], ["guest@example.com"])
        self.assertEqual(payload["subject"], "We've received your RSVP — Lucy & Kosta")
        self.assertIn("Your RSVP summary", payload["html"])
        self.assertIn("Your RSVP summary", payload["text"])
        self.assertEqual(request.get_header("Authorization"), "Bearer server-side-test-key")

    def test_public_email_assets_are_optimized_and_deployable(self):
        public_assets = Path(__file__).resolve().parents[2] / "frontend" / "public" / "email-assets"
        scenic = public_assets / "barnacarry-bay.jpg"
        couple = public_assets / "lucy-and-kosta.jpg"

        self.assertTrue(scenic.is_file())
        self.assertTrue(couple.is_file())
        self.assertLess(scenic.stat().st_size, 200_000)
        self.assertLess(couple.stat().st_size, 100_000)


class RSVPEmailDeliveryDiagnosticsTests(unittest.TestCase):
    def message(self) -> rsvp_notifications.EmailMessage:
        return rsvp_notifications.EmailMessage(
            recipients=("private-guest@example.com",),
            subject="Test subject",
            text="Private RSVP text",
            idempotency_key="diagnostic-test/1",
        )

    def test_http_failure_exposes_only_status_and_safe_provider_code(self):
        response = {
            "name": "validation_error",
            "message": "Invalid recipient private-guest@example.com",
        }
        http_error = HTTPError(
            rsvp_notifications.RESEND_EMAILS_URL,
            403,
            "Forbidden",
            {},
            io.BytesIO(json.dumps(response).encode("utf-8")),
        )

        with patch.object(
            rsvp_notifications, "urlopen", side_effect=http_error
        ), self.assertRaises(rsvp_notifications.EmailDeliveryError) as raised:
            rsvp_notifications._send_resend_email(
                self.message(), "sender@example.com", "secret-api-key"
            )

        detail = rsvp_notifications.notification_error_log_detail(raised.exception)
        self.assertEqual(
            detail,
            "provider_http_error status=403 provider_code=validation_error",
        )
        self.assertNotIn("private-guest@example.com", detail)
        self.assertNotIn("secret-api-key", detail)

    def test_pre_api_1010_failure_is_identified_without_logging_html(self):
        http_error = HTTPError(
            rsvp_notifications.RESEND_EMAILS_URL,
            403,
            "Forbidden",
            {},
            io.BytesIO(b"<html>Error code 1010: request blocked</html>"),
        )

        with patch.object(
            rsvp_notifications, "urlopen", side_effect=http_error
        ), self.assertRaises(rsvp_notifications.EmailDeliveryError) as raised:
            rsvp_notifications._send_resend_email(
                self.message(), "sender@example.com", "secret-api-key"
            )

        self.assertEqual(
            rsvp_notifications.notification_error_log_detail(raised.exception),
            "provider_http_error status=403 provider_code=1010",
        )

    def test_dns_and_timeout_failures_have_distinct_diagnostics(self):
        failures = (
            (
                URLError(socket.gaierror("private network detail")),
                "provider_network_error category=dns",
            ),
            (
                TimeoutError("private timeout detail"),
                "provider_timeout timeout_seconds=5",
            ),
        )

        for failure, expected_detail in failures:
            with self.subTest(expected_detail=expected_detail), patch.object(
                rsvp_notifications, "urlopen", side_effect=failure
            ), self.assertRaises(rsvp_notifications.EmailDeliveryError) as raised:
                rsvp_notifications._send_resend_email(
                    self.message(), "sender@example.com", "secret-api-key"
                )
            self.assertEqual(
                rsvp_notifications.notification_error_log_detail(raised.exception),
                expected_detail,
            )

    def test_unexpected_error_text_is_not_exposed_to_logs(self):
        detail = rsvp_notifications.notification_error_log_detail(
            RuntimeError("private RSVP or provider detail")
        )

        self.assertEqual(detail, "unexpected_error")


if __name__ == "__main__":
    unittest.main()
