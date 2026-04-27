import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    ContentEntry,
    ContentEntryRequest,
    ContentReorderRequest,
    Guest,
    RSVP,
    RSVPRequest,
)
from app.routers import admin
from app.routers.admin import (
    admin_create_content,
    admin_delete_content,
    admin_delete_rsvp,
    admin_reorder_content,
    admin_update_content,
    admin_upsert_rsvp,
    delete_guest,
)


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

    def test_content_crud_and_reorder(self):
        with Session(self.engine) as session:
            first = admin_create_content(
                "schedule",
                ContentEntryRequest(title="Ceremony", date="Saturday"),
                session,
                None,
            )
            second = admin_create_content(
                "schedule",
                ContentEntryRequest(title="Dinner", date="Saturday"),
                session,
                None,
            )

            admin_update_content(
                "schedule",
                first["id"],
                ContentEntryRequest(
                    title="Ceremony updated",
                    date="Saturday",
                    time="3:00 PM",
                ),
                session,
                None,
            )
            reordered = admin_reorder_content(
                "schedule",
                ContentReorderRequest(ids=[second["id"], first["id"]]),
                session,
                None,
            )

            self.assertEqual([entry["id"] for entry in reordered], [second["id"], first["id"]])

            admin_delete_content("schedule", second["id"], session, None)
            entries = session.exec(
                select(ContentEntry).where(ContentEntry.kind == "schedule")
            ).all()

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].title, "Ceremony updated")
        self.assertEqual(entries[0].time, "3:00 PM")
        self.assertEqual(entries[0].sort_order, 0)

    def test_accommodation_website_url_requires_http_url(self):
        with self.assertRaises(ValueError):
            ContentEntryRequest(title="Hotel", website_url="example.com")

        payload = ContentEntryRequest(
            title="Hotel",
            website_url="https://example.com",
        )

        self.assertEqual(payload.website_url, "https://example.com")

    def test_admin_content_write_requires_admin_secret_header(self):
        protected_routes = [
            route
            for route in admin.router.routes
            if isinstance(route, APIRoute)
            and route.path.startswith("/admin/content")
            and route.methods.intersection({"POST", "PUT", "DELETE"})
        ]

        self.assertTrue(protected_routes)

        for route in protected_routes:
            dependency_names = {
                dependency.call.__name__
                for dependency in route.dependant.dependencies
                if dependency.call
            }
            self.assertIn("verify_admin", dependency_names)


if __name__ == "__main__":
    unittest.main()
