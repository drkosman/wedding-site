import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, inspect, text

from app import database


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


if __name__ == "__main__":
    unittest.main()
