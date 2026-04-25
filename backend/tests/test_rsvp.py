import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import Guest, RSVP, RSVPRequest
from app.routers.rsvp import submit_rsvp


class RSVPRouteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)

    def create_guest(self, max_guests=2):
        with Session(self.engine) as session:
            guest = Guest(
                name="Test Guest",
                email="guest@example.com",
                token="test-token",
                plus_one_allowed=max_guests > 1,
                max_guests=max_guests,
            )
            session.add(guest)
            session.commit()
            session.refresh(guest)
            return guest

    def test_submit_rsvp_stores_form_choices(self):
        self.create_guest(max_guests=2)

        with Session(self.engine) as session:
            response = submit_rsvp(
                "test-token",
                RSVPRequest(
                    attending=True,
                    guest_count=2,
                    sunday_event=True,
                    hotel_reservation_requested=True,
                    friday_night=True,
                    saturday_night=True,
                    sunday_night=False,
                    dietary_requirements="Vegetarian",
                    message="Cannot wait",
                ),
                session,
            )

            rsvp = session.exec(select(RSVP)).one()

        self.assertEqual(response, {"status": "success"})
        self.assertTrue(rsvp.attending)
        self.assertEqual(rsvp.guest_count, 2)
        self.assertTrue(rsvp.sunday_event)
        self.assertTrue(rsvp.hotel_reservation_requested)
        self.assertTrue(rsvp.friday_night)
        self.assertTrue(rsvp.saturday_night)
        self.assertFalse(rsvp.sunday_night)
        self.assertEqual(rsvp.dietary_requirements, "Vegetarian")
        self.assertEqual(rsvp.message, "Cannot wait")

    def test_submit_rsvp_updates_existing_response(self):
        self.create_guest(max_guests=2)

        with Session(self.engine) as session:
            submit_rsvp(
                "test-token",
                RSVPRequest(
                    attending=True,
                    guest_count=2,
                    sunday_event=True,
                    hotel_reservation_requested=True,
                    friday_night=True,
                    saturday_night=True,
                    sunday_night=True,
                ),
                session,
            )

            submit_rsvp(
                "test-token",
                RSVPRequest(
                    attending=False,
                    guest_count=1,
                    sunday_event=False,
                    hotel_reservation_requested=False,
                    friday_night=False,
                    saturday_night=False,
                    sunday_night=False,
                    message="Sorry to miss it",
                ),
                session,
            )

            rsvps = session.exec(select(RSVP)).all()

        self.assertEqual(len(rsvps), 1)
        self.assertFalse(rsvps[0].attending)
        self.assertEqual(rsvps[0].guest_count, 1)
        self.assertFalse(rsvps[0].sunday_event)
        self.assertFalse(rsvps[0].hotel_reservation_requested)
        self.assertEqual(rsvps[0].message, "Sorry to miss it")

    def test_submit_rsvp_rejects_too_many_guests(self):
        self.create_guest(max_guests=1)

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as error:
                submit_rsvp(
                    "test-token",
                    RSVPRequest(attending=True, guest_count=2),
                    session,
                )

        self.assertEqual(error.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
