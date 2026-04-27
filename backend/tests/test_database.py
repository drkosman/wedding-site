import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, inspect, text

from app import database
from app.models import ContentEntry


class DatabaseMigrationTests(unittest.TestCase):
    def test_guest_tokens_are_added_and_backfilled_for_existing_tables(self):
        database_path = Path(tempfile.gettempdir()) / "wedding-token-migration-check.db"
        database_path.unlink(missing_ok=True)
        original_engine = database.engine

        try:
            database.engine = create_engine(f"sqlite:///{database_path}")

            with database.engine.begin() as connection:
                connection.execute(
                    text(
                        "CREATE TABLE guest ("
                        "id INTEGER PRIMARY KEY, "
                        "name VARCHAR NOT NULL, "
                        "email VARCHAR"
                        ")"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO guest (id, name, email) "
                        "VALUES (1, 'Old Guest', 'old@example.com')"
                    )
                )

            database.ensure_guest_columns()

            columns = {
                column["name"]
                for column in inspect(database.engine).get_columns("guest")
            }

            with database.engine.begin() as connection:
                token = connection.execute(
                    text("SELECT token FROM guest WHERE id = 1")
                ).scalar_one()
                invite_sent = connection.execute(
                    text("SELECT invite_sent FROM guest WHERE id = 1")
                ).scalar_one()

            self.assertIn("token", columns)
            self.assertIn("invite_sent", columns)
            self.assertTrue(token)
            self.assertFalse(invite_sent)
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
                schedule_entries = session.exec(
                    database.select(ContentEntry).where(ContentEntry.kind == "schedule")
                ).all()
                accommodation_entries = session.exec(
                    database.select(ContentEntry).where(ContentEntry.kind == "accommodation")
                ).all()
                travel_entries = session.exec(
                    database.select(ContentEntry).where(ContentEntry.kind == "travel")
                ).all()

            self.assertEqual(len(schedule_entries), 2)
            self.assertEqual(len(accommodation_entries), 1)
            self.assertEqual(len(travel_entries), 4)
        finally:
            database.engine = original_engine
            database_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
