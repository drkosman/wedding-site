from sqlalchemy import Column, DateTime, Engine, Index, Integer, MetaData, String, Table, inspect, text


MIGRATION_ID = "002_homepage_sections"
TABLE_NAME = "homepagesection"


def _create_homepage_section_table(engine: Engine) -> None:
    metadata = MetaData()
    table = Table(
        TABLE_NAME,
        metadata,
        Column("id", Integer, primary_key=True),
        Column("title", String(160), nullable=False),
        Column("subtitle", String(300), nullable=True),
        Column("content", String(10000), nullable=False),
        Column("position", Integer, nullable=False),
        Column("sort_order", Integer, nullable=False, default=0),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    Index(f"ix_{TABLE_NAME}_position", table.c.position)
    Index(f"ix_{TABLE_NAME}_sort_order", table.c.sort_order)
    metadata.create_all(engine, tables=[table])


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

    if not inspect(engine).has_table(TABLE_NAME):
        _create_homepage_section_table(engine)

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
