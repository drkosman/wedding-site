import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    AdminRSVPRequest,
    ContentEntry,
    ContentEntryRequest,
    ContentReorderRequest,
    Guest,
    HomepageSection,
    HomepageSectionReorderRequest,
    HomepageSectionRequest,
    RSVP,
    ReconcileRSVPRequest,
)
from app.routers import admin
from app.routers.admin import (
    admin_create_content,
    admin_delete_content,
    admin_delete_homepage_section,
    admin_delete_rsvp,
    admin_create_homepage_section,
    admin_reorder_homepage_sections,
    admin_reorder_content,
    admin_update_content,
    admin_update_homepage_section,
    admin_update_rsvp,
    delete_guest,
    list_rsvps,
    reconcile_rsvp,
)
from app.routers.content import public_homepage_sections


def admin_payload(**overrides) -> AdminRSVPRequest:
    values = {
        "full_name": "Submitted Guest",
        "email": "submitted@example.com",
        "attending": True,
        "guest_count": 2,
        "additional_guest_names": "Additional Guest",
        "sunday_event": True,
        "hotel_reservation_requested": True,
        "saturday_night": True,
    }
    values.update(overrides)
    return AdminRSVPRequest(**values)


class AdminRouteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)

    def create_guest(self, max_guests: int = 2) -> Guest:
        with Session(self.engine) as session:
            guest = Guest(
                name="Invitation Party",
                email="invited@example.com",
                max_guests=max_guests,
            )
            session.add(guest)
            session.commit()
            session.refresh(guest)
            return guest

    def create_rsvp(self, **overrides) -> RSVP:
        values = {
            "submitted_name": "Submitted Guest",
            "email": "submitted@example.com",
            "attending": True,
            "guest_count": 2,
            "additional_guest_names": "Additional Guest",
        }
        values.update(overrides)
        with Session(self.engine) as session:
            rsvp = RSVP(**values)
            session.add(rsvp)
            session.commit()
            session.refresh(rsvp)
            return rsvp

    def test_admin_list_exposes_submission_details_and_duplicate_signal(self):
        self.create_rsvp()
        self.create_rsvp(submitted_name="Shared Email Guest")

        with Session(self.engine) as session:
            rows = list_rsvps(session, None)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["email"], "submitted@example.com")
        self.assertEqual(rows[0]["same_email_submission_count"], 2)
        self.assertIsNone(rows[0]["guest_id"])
        self.assertIn("created_at", rows[0])
        self.assertIn("additional_guest_names", rows[0])

    def test_admin_can_reconcile_without_automatic_matching(self):
        guest = self.create_guest(max_guests=2)
        rsvp = self.create_rsvp()
        with Session(self.engine) as session:
            response = reconcile_rsvp(
                rsvp.id,
                ReconcileRSVPRequest(guest_id=guest.id),
                session,
                None,
            )
            stored = session.get(RSVP, rsvp.id)

        self.assertEqual(response["guest_id"], guest.id)
        self.assertEqual(stored.guest_id, guest.id)

    def test_reconciliation_enforces_invitation_party_size(self):
        guest = self.create_guest(max_guests=1)
        rsvp = self.create_rsvp(guest_count=2)
        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as error:
                reconcile_rsvp(
                    rsvp.id,
                    ReconcileRSVPRequest(guest_id=guest.id),
                    session,
                    None,
                )
        self.assertEqual(error.exception.status_code, 400)

    def test_admin_update_edits_submission_and_preserves_identity_fields(self):
        rsvp = self.create_rsvp()
        with Session(self.engine) as session:
            admin_update_rsvp(
                rsvp.id,
                admin_payload(
                    full_name="Corrected Name",
                    email="corrected@example.com",
                    attending=False,
                    guest_count=1,
                    additional_guest_names=None,
                    sunday_event=False,
                    hotel_reservation_requested=False,
                    saturday_night=False,
                    message="Updated by admin",
                ),
                session,
                None,
            )
            stored = session.get(RSVP, rsvp.id)

        self.assertEqual(stored.submitted_name, "Corrected Name")
        self.assertEqual(stored.email, "corrected@example.com")
        self.assertFalse(stored.attending)
        self.assertEqual(stored.message, "Updated by admin")

    def test_deleting_guest_unmatches_but_preserves_submission(self):
        guest = self.create_guest()
        rsvp = self.create_rsvp(guest_id=guest.id)
        with Session(self.engine) as session:
            delete_guest(guest.id, session, None)
            stored_rsvp = session.get(RSVP, rsvp.id)
            stored_guest = session.get(Guest, guest.id)

        self.assertIsNone(stored_guest)
        self.assertIsNotNone(stored_rsvp)
        self.assertIsNone(stored_rsvp.guest_id)

    def test_admin_delete_rsvp_removes_only_submission(self):
        guest = self.create_guest()
        rsvp = self.create_rsvp(guest_id=guest.id)
        with Session(self.engine) as session:
            admin_delete_rsvp(rsvp.id, session, None)
            self.assertIsNotNone(session.get(Guest, guest.id))
            self.assertIsNone(session.get(RSVP, rsvp.id))

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
                ContentEntryRequest(title="Ceremony updated", time="3:00 PM"),
                session,
                None,
            )
            reordered = admin_reorder_content(
                "schedule",
                ContentReorderRequest(ids=[second["id"], first["id"]]),
                session,
                None,
            )
            admin_delete_content("schedule", second["id"], session, None)
            entries = session.exec(select(ContentEntry)).all()

        self.assertEqual([entry["id"] for entry in reordered], [second["id"], first["id"]])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].sort_order, 0)

    def test_accommodation_website_url_requires_http_url(self):
        with self.assertRaises(ValueError):
            ContentEntryRequest(title="Hotel", website_url="example.com")
        payload = ContentEntryRequest(title="Hotel", website_url="https://example.com")
        self.assertEqual(payload.website_url, "https://example.com")

    def test_homepage_section_crud_ordering_and_public_retrieval(self):
        with Session(self.engine) as session:
            first = admin_create_homepage_section(
                HomepageSectionRequest(
                    title="  Welcome note  ",
                    subtitle="  From us  ",
                    content="  First paragraph\n\nSecond paragraph  ",
                    position=2,
                ),
                session,
                None,
            )
            second = admin_create_homepage_section(
                HomepageSectionRequest(
                    title="Things to know",
                    subtitle="   ",
                    content="Useful details",
                    position=2,
                ),
                session,
                None,
            )

            self.assertEqual(first["title"], "Welcome note")
            self.assertEqual(first["subtitle"], "From us")
            self.assertEqual(first["content"], "First paragraph\n\nSecond paragraph")
            self.assertIsNone(second["subtitle"])
            self.assertEqual((first["sort_order"], second["sort_order"]), (0, 1))

            updated = admin_update_homepage_section(
                first["id"],
                HomepageSectionRequest(
                    title="Welcome updated",
                    subtitle=None,
                    content="Updated copy",
                    position=2,
                ),
                session,
                None,
            )
            with self.assertRaises(HTTPException) as reorder_error:
                admin_reorder_homepage_sections(
                    HomepageSectionReorderRequest(position=2, ids=[first["id"]]),
                    session,
                    None,
                )
            reordered = admin_reorder_homepage_sections(
                HomepageSectionReorderRequest(
                    position=2,
                    ids=[second["id"], first["id"]],
                ),
                session,
                None,
            )
            public_sections = public_homepage_sections(session)

            self.assertEqual(updated["title"], "Welcome updated")
            self.assertEqual(reorder_error.exception.status_code, 400)
            self.assertEqual(
                [section["id"] for section in reordered],
                [second["id"], first["id"]],
            )
            self.assertNotIn("created_at", public_sections[0])
            self.assertNotIn("updated_at", public_sections[0])

            admin_delete_homepage_section(second["id"], session, None)
            stored = session.exec(select(HomepageSection)).all()

        self.assertEqual(len(stored), 1)
        self.assertEqual(stored[0].title, "Welcome updated")
        self.assertEqual(stored[0].sort_order, 0)

    def test_moving_homepage_section_compacts_old_position_and_appends_to_new(self):
        with Session(self.engine) as session:
            first = admin_create_homepage_section(
                HomepageSectionRequest(
                    title="First",
                    content="First content",
                    position=1,
                ),
                session,
                None,
            )
            second = admin_create_homepage_section(
                HomepageSectionRequest(
                    title="Second",
                    content="Second content",
                    position=1,
                ),
                session,
                None,
            )
            existing_at_destination = admin_create_homepage_section(
                HomepageSectionRequest(
                    title="Destination",
                    content="Destination content",
                    position=4,
                ),
                session,
                None,
            )

            moved = admin_update_homepage_section(
                first["id"],
                HomepageSectionRequest(
                    title="First",
                    content="First content",
                    position=4,
                ),
                session,
                None,
            )
            remaining = session.get(HomepageSection, second["id"])

        self.assertEqual(remaining.sort_order, 0)
        self.assertEqual(moved["position"], 4)
        self.assertEqual(moved["sort_order"], existing_at_destination["sort_order"] + 1)

    def test_homepage_section_validation_rejects_blank_oversized_and_malformed_input(self):
        with self.assertRaises(ValueError):
            HomepageSectionRequest(title=" ", content="Content", position=0)
        with self.assertRaises(ValueError):
            HomepageSectionRequest(title="Title", content=" \n ", position=0)
        with self.assertRaises(ValueError):
            HomepageSectionRequest(title="x" * 161, content="Content", position=0)
        with self.assertRaises(ValueError):
            HomepageSectionRequest(title="Title", content="Content", position=7)
        with self.assertRaises(ValueError):
            HomepageSectionRequest(
                title="Title",
                content="Content",
                position=0,
                unexpected="value",
            )

    def test_public_homepage_sections_empty_state(self):
        with Session(self.engine) as session:
            self.assertEqual(public_homepage_sections(session), [])

    def test_homepage_section_persists_across_sessions(self):
        with Session(self.engine) as session:
            created = admin_create_homepage_section(
                HomepageSectionRequest(
                    title="Persistent section",
                    content="Stored in the database",
                    position=3,
                ),
                session,
                None,
            )

        with Session(self.engine) as session:
            stored = session.get(HomepageSection, created["id"])

        self.assertIsNotNone(stored)
        self.assertEqual(stored.title, "Persistent section")

    def test_all_admin_routes_require_admin_secret(self):
        protected_routes = [
            route for route in admin.router.routes if isinstance(route, APIRoute)
        ]
        self.assertTrue(protected_routes)
        for route in protected_routes:
            dependency_names = {
                dependency.call.__name__
                for dependency in route.dependant.dependencies
                if dependency.call
            }
            self.assertIn("verify_admin", dependency_names, route.path)


if __name__ == "__main__":
    unittest.main()
