from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine, Session, select

from .config import DATABASE_URL, IS_DEV
from .models import ContentEntry

try:
    from backend.migrations.versions.v001_public_rsvp import upgrade as upgrade_public_rsvp
except ModuleNotFoundError:  # Backend container imports `app` from /app.
    from migrations.versions.v001_public_rsvp import upgrade as upgrade_public_rsvp

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
    upgrade_public_rsvp(engine)
    ensure_rsvp_columns()
    ensure_content_entry_columns()
    seed_default_content_entries()


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


def ensure_content_entry_columns():
    inspector = inspect(engine)

    if not inspector.has_table("contententry"):
        return

    columns = {column["name"] for column in inspector.get_columns("contententry")}

    text_columns = {
        "description",
        "date",
        "time",
        "location",
        "notes",
        "address",
        "price_notes",
        "distance",
        "website_url",
    }

    with engine.begin() as connection:
        if "sort_order" not in columns:
            connection.execute(
                text("ALTER TABLE contententry ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
            )

        if "updated_at" not in columns:
            if engine.dialect.name == "postgresql":
                connection.execute(
                    text(
                        "ALTER TABLE contententry ADD COLUMN "
                        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    )
                )
            else:
                connection.execute(
                    text(
                        "ALTER TABLE contententry ADD COLUMN "
                        "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"
                    )
                )

        for column_name in text_columns - columns:
            connection.execute(
                text(f"ALTER TABLE contententry ADD COLUMN {column_name} VARCHAR")
            )


def seed_default_content_entries():
    defaults = {
        "schedule": [
            {
                "sort_order": 0,
                "date": "Saturday",
                "title": "Ceremony, Reception",
            },
            {
                "sort_order": 1,
                "date": "Sunday",
                "title": "Sunday brunch (tbd)",
            },
        ],
        "accommodation": [
            {
                "sort_order": 0,
                "title": "Oban",
                "description": "Recommended hotels will be listed soon.",
                "notes": "Nearest town",
            },
        ],
        "travel": [
            {
                "sort_order": 0,
                "title": "By car",
                "description": (
                    "Oban is accessible by car via the A82 and A85, offering a scenic "
                    "drive through the Scottish Highlands. Please allow extra time for "
                    "narrow roads and slower traffic in rural areas. The ceremony will "
                    "take place in Oban, and the reception is at Barnacarry Bay, "
                    "approximately a 20-minute drive away. Shuttle transport will be "
                    "provided and strongly encouraged, as parking at the reception is "
                    "very limited."
                ),
            },
            {
                "sort_order": 1,
                "title": "By train",
                "description": (
                    "Regular train services run from Glasgow to Oban, offering a direct "
                    "(and stunning!) journey of around 3 hours. From Oban station, the "
                    "ceremony location is nearby. Shuttle transport will be provided to "
                    "take guests from the ceremony to the reception at Barnacarry Bay."
                ),
            },
            {
                "sort_order": 2,
                "title": "By air",
                "description": (
                    "The nearest major airport is Glasgow Airport. From there, you can "
                    "take a transfer into Glasgow city centre and board a direct train "
                    "to Oban. The train journey is straightforward and highly "
                    "recommended for its scenic views."
                ),
            },
            {
                "sort_order": 3,
                "title": "Getting away",
                "description": (
                    "Return travel is via Oban. Guests can take the train from Oban "
                    "back to Glasgow, with onward connections by rail or air. Shuttle "
                    "transport will return guests from the reception to central Oban "
                    "following the celebrations."
                ),
            },
        ],
    }

    with Session(engine) as session:
        for kind, entries in defaults.items():
            existing = session.exec(
                select(ContentEntry).where(ContentEntry.kind == kind)
            ).first()

            if existing:
                continue

            for entry in entries:
                session.add(ContentEntry(kind=kind, **entry))

        session.commit()


def get_session():
    with Session(engine) as session:
        yield session
