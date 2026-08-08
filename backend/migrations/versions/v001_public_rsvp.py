from sqlalchemy import Engine, inspect, text


MIGRATION_ID = "001_public_rsvp"


def _column_expression(columns: set[str], name: str, fallback: str) -> str:
    return name if name in columns else fallback


def _sqlite_rebuild(engine: Engine) -> None:
    inspector = inspect(engine)
    guest_columns = {column["name"] for column in inspector.get_columns("guest")}
    rsvp_columns = {column["name"] for column in inspector.get_columns("rsvp")}

    guest_is_legacy = bool({"token", "plus_one_allowed"} & guest_columns)
    rsvp_is_legacy = "submitted_name" not in rsvp_columns or "email" not in rsvp_columns
    if not guest_is_legacy and not rsvp_is_legacy:
        return

    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()

        with connection.begin():
            connection.execute(text("ALTER TABLE rsvp RENAME TO rsvp_legacy"))
            connection.execute(text("ALTER TABLE guest RENAME TO guest_legacy"))
            connection.execute(
                text(
                    "CREATE TABLE guest ("
                    "id INTEGER NOT NULL PRIMARY KEY, "
                    "name VARCHAR(160) NOT NULL, "
                    "email VARCHAR(254), "
                    "max_guests INTEGER NOT NULL, "
                    "invite_sent BOOLEAN NOT NULL"
                    ")"
                )
            )
            connection.execute(
                text(
                    "CREATE TABLE rsvp ("
                    "id INTEGER NOT NULL PRIMARY KEY, "
                    "guest_id INTEGER, "
                    "submitted_name VARCHAR(160) NOT NULL, "
                    "email VARCHAR(254) NOT NULL, "
                    "attending BOOLEAN NOT NULL, "
                    "guest_count INTEGER NOT NULL, "
                    "additional_guest_names VARCHAR(600), "
                    "sunday_event BOOLEAN NOT NULL, "
                    "hotel_reservation_requested BOOLEAN NOT NULL, "
                    "friday_night BOOLEAN NOT NULL, "
                    "saturday_night BOOLEAN NOT NULL, "
                    "sunday_night BOOLEAN NOT NULL, "
                    "dietary_requirements VARCHAR(1000), "
                    "message VARCHAR(2000), "
                    "created_at DATETIME NOT NULL, "
                    "updated_at DATETIME NOT NULL, "
                    "FOREIGN KEY(guest_id) REFERENCES guest (id)"
                    ")"
                )
            )

            guest_max = _column_expression(guest_columns, "max_guests", "1")
            invite_sent = _column_expression(guest_columns, "invite_sent", "0")
            connection.execute(
                text(
                    "INSERT INTO guest (id, name, email, max_guests, invite_sent) "
                    f"SELECT id, name, email, COALESCE({guest_max}, 1), "
                    f"COALESCE({invite_sent}, 0) FROM guest_legacy"
                )
            )

            submitted_name = (
                "r.submitted_name"
                if "submitted_name" in rsvp_columns
                else "COALESCE(g.name, 'Legacy RSVP')"
            )
            email = (
                "r.email"
                if "email" in rsvp_columns
                else "COALESCE(g.email, 'legacy-rsvp-' || r.id || '@invalid.example')"
            )
            guest_count = _column_expression(rsvp_columns, "guest_count", "1")
            additional_names = _column_expression(
                rsvp_columns, "additional_guest_names", "NULL"
            )
            sunday = _column_expression(rsvp_columns, "sunday_event", "0")
            hotel = _column_expression(
                rsvp_columns, "hotel_reservation_requested", "0"
            )
            friday = _column_expression(rsvp_columns, "friday_night", "0")
            saturday = _column_expression(rsvp_columns, "saturday_night", "0")
            sunday_night = _column_expression(rsvp_columns, "sunday_night", "0")
            dietary = _column_expression(rsvp_columns, "dietary_requirements", "NULL")
            message = _column_expression(rsvp_columns, "message", "NULL")
            updated_at = _column_expression(
                rsvp_columns, "updated_at", "CURRENT_TIMESTAMP"
            )
            created_at = _column_expression(rsvp_columns, "created_at", updated_at)

            connection.execute(
                text(
                    "INSERT INTO rsvp ("
                    "id, guest_id, submitted_name, email, attending, guest_count, "
                    "additional_guest_names, sunday_event, hotel_reservation_requested, "
                    "friday_night, saturday_night, sunday_night, dietary_requirements, "
                    "message, created_at, updated_at"
                    ") SELECT "
                    f"r.id, r.guest_id, {submitted_name}, {email}, r.attending, "
                    f"COALESCE({guest_count}, 1), {additional_names}, "
                    f"COALESCE({sunday}, 0), COALESCE({hotel}, 0), "
                    f"COALESCE({friday}, 0), COALESCE({saturday}, 0), "
                    f"COALESCE({sunday_night}, 0), {dietary}, {message}, "
                    f"COALESCE({created_at}, CURRENT_TIMESTAMP), "
                    f"COALESCE({updated_at}, CURRENT_TIMESTAMP) "
                    "FROM rsvp_legacy r "
                    "LEFT JOIN guest_legacy g ON g.id = r.guest_id"
                )
            )

            connection.execute(text("DROP TABLE rsvp_legacy"))
            connection.execute(text("DROP TABLE guest_legacy"))
            connection.execute(text("CREATE INDEX ix_guest_email ON guest (email)"))
            connection.execute(text("CREATE INDEX ix_rsvp_guest_id ON rsvp (guest_id)"))
            connection.execute(text("CREATE INDEX ix_rsvp_submitted_name ON rsvp (submitted_name)"))
            connection.execute(text("CREATE INDEX ix_rsvp_email ON rsvp (email)"))
            connection.execute(text("CREATE INDEX ix_rsvp_created_at ON rsvp (created_at)"))

        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()


def _postgresql_alter(engine: Engine) -> None:
    inspector = inspect(engine)
    guest_columns = {column["name"] for column in inspector.get_columns("guest")}
    rsvp_columns = {column["name"] for column in inspector.get_columns("rsvp")}

    with engine.begin() as connection:
        if "invite_sent" not in guest_columns:
            connection.execute(
                text("ALTER TABLE guest ADD COLUMN invite_sent BOOLEAN NOT NULL DEFAULT false")
            )
        email_column = next(
            column for column in inspector.get_columns("guest") if column["name"] == "email"
        )
        if not email_column["nullable"]:
            connection.execute(text("ALTER TABLE guest ALTER COLUMN email DROP NOT NULL"))
        if "token" in guest_columns:
            connection.execute(text("ALTER TABLE guest DROP COLUMN token CASCADE"))
        if "plus_one_allowed" in guest_columns:
            connection.execute(text("ALTER TABLE guest DROP COLUMN plus_one_allowed"))

        if "submitted_name" not in rsvp_columns:
            connection.execute(text("ALTER TABLE rsvp ADD COLUMN submitted_name VARCHAR(160)"))
        if "email" not in rsvp_columns:
            connection.execute(text("ALTER TABLE rsvp ADD COLUMN email VARCHAR(254)"))
        if "additional_guest_names" not in rsvp_columns:
            connection.execute(
                text("ALTER TABLE rsvp ADD COLUMN additional_guest_names VARCHAR(600)")
            )
        if "created_at" not in rsvp_columns:
            connection.execute(text("ALTER TABLE rsvp ADD COLUMN created_at TIMESTAMP"))

        connection.execute(
            text(
                "UPDATE rsvp SET "
                "submitted_name = COALESCE(rsvp.submitted_name, guest.name), "
                "email = COALESCE(rsvp.email, guest.email, "
                "'legacy-rsvp-' || rsvp.id || '@invalid.example'), "
                "created_at = COALESCE(rsvp.created_at, rsvp.updated_at, CURRENT_TIMESTAMP) "
                "FROM guest WHERE rsvp.guest_id = guest.id"
            )
        )
        connection.execute(
            text(
                "UPDATE rsvp SET "
                "submitted_name = COALESCE(submitted_name, 'Legacy RSVP'), "
                "email = COALESCE(email, 'legacy-rsvp-' || id || '@invalid.example'), "
                "created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(text("ALTER TABLE rsvp ALTER COLUMN guest_id DROP NOT NULL"))
        connection.execute(text("ALTER TABLE rsvp ALTER COLUMN submitted_name SET NOT NULL"))
        connection.execute(text("ALTER TABLE rsvp ALTER COLUMN email SET NOT NULL"))
        connection.execute(text("ALTER TABLE rsvp ALTER COLUMN created_at SET NOT NULL"))

    inspector = inspect(engine)
    preparer = engine.dialect.identifier_preparer
    guest_id_constraints = [
        constraint["name"]
        for constraint in inspector.get_unique_constraints("rsvp")
        if constraint.get("column_names") == ["guest_id"] and constraint.get("name")
    ]
    with engine.begin() as connection:
        for constraint_name in guest_id_constraints:
            quoted_name = preparer.quote(constraint_name)
            connection.execute(text(f"ALTER TABLE rsvp DROP CONSTRAINT {quoted_name}"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_guest_email ON guest (email)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_rsvp_guest_id ON rsvp (guest_id)"))
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_rsvp_submitted_name ON rsvp (submitted_name)")
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_rsvp_email ON rsvp (email)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_rsvp_created_at ON rsvp (created_at)"))


def upgrade(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migration ("
                "id VARCHAR(100) PRIMARY KEY, "
                "applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
                ")"
            )
        )
        already_applied = connection.execute(
            text("SELECT id FROM schema_migration WHERE id = :migration_id"),
            {"migration_id": MIGRATION_ID},
        ).first()
    if already_applied:
        return

    inspector = inspect(engine)
    if not inspector.has_table("guest") or not inspector.has_table("rsvp"):
        return
    if engine.dialect.name == "sqlite":
        _sqlite_rebuild(engine)
    elif engine.dialect.name == "postgresql":
        _postgresql_alter(engine)
    else:
        raise RuntimeError(f"Unsupported database dialect: {engine.dialect.name}")

    with engine.begin() as connection:
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
