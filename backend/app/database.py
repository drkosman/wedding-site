from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine, Session

from app.config import DATABASE_URL, IS_DEV 

BOOLEAN_DEFAULT_FALSE = {
    "sunday_event",
    "hotel_reservation_requested",
    "friday_night",
    "saturday_night",
    "sunday_night",
}

engine = create_engine(
    DATABASE_URL,
    echo=IS_DEV,
    pool_pre_ping=True
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    ensure_guest_columns()
    ensure_rsvp_columns()


def ensure_guest_columns():
    inspector = inspect(engine)

    if not inspector.has_table("guest"):
        return

    columns = {column["name"]: column for column in inspector.get_columns("guest")}
    email_column = columns.get("email")

    if (
        email_column
        and not email_column["nullable"]
        and engine.dialect.name == "postgresql"
    ):
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE guest ALTER COLUMN email DROP NOT NULL"))


def ensure_rsvp_columns():
    inspector = inspect(engine)

    if not inspector.has_table("rsvp"):
        return

    columns = {column["name"] for column in inspector.get_columns("rsvp")}

    with engine.begin() as connection:
        if "guest_count" not in columns:
            connection.execute(
                text("ALTER TABLE rsvp ADD COLUMN guest_count INTEGER NOT NULL DEFAULT 1")
            )

        for column_name in BOOLEAN_DEFAULT_FALSE - columns:
            default = "false" if engine.dialect.name == "postgresql" else "0"
            connection.execute(
                text(
                    f"ALTER TABLE rsvp ADD COLUMN {column_name} "
                    f"BOOLEAN NOT NULL DEFAULT {default}"
                )
            )


def get_session():
    with Session(engine) as session:
        yield session
