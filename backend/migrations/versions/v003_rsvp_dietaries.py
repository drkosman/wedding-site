from sqlalchemy import Engine, inspect, text


MIGRATION_ID = "003_rsvp_dietaries"


def upgrade(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migration ("
                "id VARCHAR(100) NOT NULL PRIMARY KEY, "
                "applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        already_applied = connection.execute(
            text("SELECT id FROM schema_migration WHERE id = :migration_id"),
            {"migration_id": MIGRATION_ID},
        ).first()

    if already_applied:
        return

    inspector = inspect(engine)
    if not inspector.has_table("rsvp"):
        return

    columns = {column["name"] for column in inspector.get_columns("rsvp")}
    with engine.begin() as connection:
        if "dietaries" not in columns:
            connection.execute(text("ALTER TABLE rsvp ADD COLUMN dietaries VARCHAR(1000)"))
        if "dietary_requirements" in columns:
            connection.execute(text("ALTER TABLE rsvp DROP COLUMN dietary_requirements"))

        if engine.dialect.name == "postgresql":
            connection.execute(
                text(
                    "INSERT INTO schema_migration (id) VALUES (:migration_id) "
                    "ON CONFLICT (id) DO NOTHING"
                ),
                {"migration_id": MIGRATION_ID},
            )
        else:
            connection.execute(
                text("INSERT OR IGNORE INTO schema_migration (id) VALUES (:migration_id)"),
                {"migration_id": MIGRATION_ID},
            )
