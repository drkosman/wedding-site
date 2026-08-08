import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, inspect, text

from app import database
from app.models import ContentEntry, Guest, HomepageSection, RSVP


class DatabaseMigrationTests(unittest.TestCase):
    def test_legacy_token_schema_is_migrated_without_losing_guest_or_rsvp(self):
        database_path = Path(tempfile.gettempdir()) / "wedding-public-rsvp-migration.db"
        database_path.unlink(missing_ok=True)
        original_engine = database.engine

        try:
            database.engine = create_engine(f"sqlite:///{database_path}")
            with database.engine.begin() as connection:
                connection.execute(
                    text(
                        "CREATE TABLE guest ("
                        "id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, email VARCHAR, "
                        "token VARCHAR UNIQUE NOT NULL, plus_one_allowed BOOLEAN NOT NULL, "
                        "max_guests INTEGER NOT NULL, invite_sent BOOLEAN NOT NULL)"
                    )
                )
                connection.execute(
                    text(
                        "CREATE TABLE rsvp ("
                        "id INTEGER PRIMARY KEY, guest_id INTEGER UNIQUE NOT NULL, "
                        "attending BOOLEAN NOT NULL, guest_count INTEGER NOT NULL, "
                        "sunday_event BOOLEAN NOT NULL, hotel_reservation_requested BOOLEAN NOT NULL, "
                        "friday_night BOOLEAN NOT NULL, saturday_night BOOLEAN NOT NULL, "
                        "sunday_night BOOLEAN NOT NULL, dietary_requirements VARCHAR, "
                        "message VARCHAR, updated_at DATETIME NOT NULL, "
                        "FOREIGN KEY(guest_id) REFERENCES guest(id))"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO guest VALUES "
                        "(1, 'Existing Guest', 'existing@example.com', 'legacy-token', 1, 3, 1)"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO rsvp VALUES "
                        "(1, 1, 1, 2, 1, 0, 0, 0, 0, 'Vegetarian', 'Hello', CURRENT_TIMESTAMP)"
                    )
                )

            database.create_db_and_tables()
            database.create_db_and_tables()

            guest_columns = {column["name"] for column in inspect(database.engine).get_columns("guest")}
            rsvp_columns = {column["name"] for column in inspect(database.engine).get_columns("rsvp")}
            with database.engine.begin() as connection:
                migration_count = connection.execute(
                    text(
                        "SELECT COUNT(*) FROM schema_migration "
                        "WHERE id = '001_public_rsvp'"
                    )
                ).scalar_one()
                dietaries_migration_count = connection.execute(
                    text(
                        "SELECT COUNT(*) FROM schema_migration "
                        "WHERE id = '003_rsvp_dietaries'"
                    )
                ).scalar_one()
            with database.Session(database.engine) as session:
                guest = session.get(Guest, 1)
                legacy_rsvp = session.get(RSVP, 1)
                session.add(
                    RSVP(
                        guest_id=1,
                        submitted_name="Second response",
                        email="second@example.com",
                        attending=False,
                    )
                )
                session.commit()
                responses = session.exec(database.select(RSVP)).all()

                guest_values = (guest.name, guest.max_guests, guest.invite_sent)
                legacy_rsvp_values = (legacy_rsvp.submitted_name, legacy_rsvp.email)

            self.assertEqual(guest_values[0], "Existing Guest")
            self.assertEqual(guest_values[1], 3)
            self.assertTrue(guest_values[2])
            self.assertNotIn("token", guest_columns)
            self.assertNotIn("plus_one_allowed", guest_columns)
            self.assertIn("submitted_name", rsvp_columns)
            self.assertIn("created_at", rsvp_columns)
            self.assertIn("dietaries", rsvp_columns)
            self.assertNotIn("dietary_requirements", rsvp_columns)
            self.assertEqual(legacy_rsvp_values[0], "Existing Guest")
            self.assertEqual(legacy_rsvp_values[1], "existing@example.com")
            self.assertEqual(len(responses), 2)
            self.assertEqual(migration_count, 1)
            self.assertEqual(dietaries_migration_count, 1)
        finally:
            database.engine = original_engine
            database_path.unlink(missing_ok=True)

    def test_create_db_and_tables_seeds_default_content_once(self):
        database_path = Path(tempfile.gettempdir()) / "wedding-content-seed-check.db"
        database_path.unlink(missing_ok=True)
        original_engine = database.engine
        try:
            database.engine = create_engine(f"sqlite:///{database_path}")
            database.create_db_and_tables()
            database.create_db_and_tables()
            with database.Session(database.engine) as session:
                counts = {
                    kind: len(
                        session.exec(
                            database.select(ContentEntry).where(ContentEntry.kind == kind)
                        ).all()
                    )
                    for kind in ("schedule", "accommodation", "travel")
                }
            self.assertEqual(counts, {"schedule": 2, "accommodation": 1, "travel": 4})
            self.assertTrue(inspect(database.engine).has_table(HomepageSection.__tablename__))
            with database.engine.begin() as connection:
                migration_count = connection.execute(
                    text(
                        "SELECT COUNT(*) FROM schema_migration "
                        "WHERE id = '002_homepage_sections'"
                    )
                ).scalar_one()
            self.assertEqual(migration_count, 1)
        finally:
            database.engine = original_engine
            database_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
