import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import Guest, RSVP, RSVPRequest
from app.routers.admin import admin_delete_rsvp, admin_upsert_rsvp, delete_guest


class AdminRouteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)

    def create_guest(self, token: str = "admin-test-token", max_guests: int = 2):
        with Session(self.engine) as session:
            guest = Guest(
                name="Admin Test Guest",
                email="admin@example.com",
                token=token,
                plus_one_allowed=max_guests > 1,
                max_guests=max_guests,
            )
            session.add(guest)
            session.commit()
            session.refresh(guest)
            return guest

    def test_admin_upsert_rsvp_creates_and_updates_response(self):
        guest = self.create_guest(max_guests=3)

        with Session(self.engine) as session:
            admin_upsert_rsvp(
                guest.id,
                RSVPRequest(
                    attending=True,
                    guest_count=2,
                    sunday_event=True,
                    hotel_reservation_requested=True,
                    friday_night=True,
                ),
                session,
                None,
            )

            admin_upsert_rsvp(
                guest.id,
                RSVPRequest(
                    attending=False,
                    guest_count=1,
                    sunday_event=False,
                    hotel_reservation_requested=False,
                    saturday_night=True,
                    dietary_requirements="Gluten free",
                    message="Updated by admin",
                ),
                session,
                None,
            )

            rsvps = session.exec(select(RSVP)).all()

        self.assertEqual(len(rsvps), 1)
        self.assertFalse(rsvps[0].attending)
        self.assertEqual(rsvps[0].guest_count, 1)
        self.assertFalse(rsvps[0].friday_night)
        self.assertTrue(rsvps[0].saturday_night)
        self.assertEqual(rsvps[0].dietary_requirements, "Gluten free")
        self.assertEqual(rsvps[0].message, "Updated by admin")

    def test_admin_upsert_rsvp_rejects_guest_count_above_limit(self):
        guest = self.create_guest(max_guests=1)

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as error:
                admin_upsert_rsvp(
                    guest.id,
                    RSVPRequest(attending=True, guest_count=2),
                    session,
                    None,
                )

        self.assertEqual(error.exception.status_code, 400)

    def test_admin_delete_rsvp_removes_only_the_response(self):
        guest = self.create_guest()

        with Session(self.engine) as session:
            admin_upsert_rsvp(
                guest.id,
                RSVPRequest(attending=True, guest_count=1),
                session,
                None,
            )
            admin_delete_rsvp(guest.id, session, None)

            remaining_guest = session.get(Guest, guest.id)
            remaining_rsvp = session.exec(select(RSVP)).all()

        self.assertIsNotNone(remaining_guest)
        self.assertEqual(remaining_rsvp, [])

    def test_delete_guest_removes_guest_and_rsvp(self):
        guest = self.create_guest()

        with Session(self.engine) as session:
            admin_upsert_rsvp(
                guest.id,
                RSVPRequest(attending=True, guest_count=1),
                session,
                None,
            )
            delete_guest(guest.id, session, None)

            remaining_guests = session.exec(select(Guest)).all()
            remaining_rsvps = session.exec(select(RSVP)).all()

        self.assertEqual(remaining_guests, [])
        self.assertEqual(remaining_rsvps, [])


if __name__ == "__main__":
    unittest.main()
