import argparse
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config
from app.models import RSVP
from app.rsvp_notifications import build_guest_confirmation


def example_rsvp(attending: bool) -> RSVP:
    common = {
        "id": 1 if attending else 2,
        "submitted_name": "Example Guest",
        "email": "guest@example.com",
        "attending": attending,
        "created_at": datetime(2026, 8, 9, 12, 30),
        "updated_at": datetime(2026, 8, 10, 14, 45),
        "message": (
            "We can't wait to celebrate with you both!\nThank you for bringing everyone together."
            if attending
            else "We are so sorry to miss it, but we will be thinking of you both."
        ),
    }
    if not attending:
        return RSVP(**common)
    return RSVP(
        **common,
        sunday_event=True,
        dietaries="Vegetarian; nut allergy",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Write local RSVP confirmation email previews.")
    parser.add_argument("--website-url", default="http://127.0.0.1:4173")
    parser.add_argument("--output-dir", type=Path, default=Path("/tmp/rsvp-email-previews"))
    args = parser.parse_args()

    config.WEDDING_WEBSITE_URL = args.website_url
    args.output_dir.mkdir(parents=True, exist_ok=True)
    previews = {
        "attending.html": build_guest_confirmation(example_rsvp(True)).html,
        "not-attending.html": build_guest_confirmation(example_rsvp(False)).html,
        "updated.html": build_guest_confirmation(example_rsvp(True), updated=True).html,
    }
    for filename, html in previews.items():
        if html is None:
            raise RuntimeError("Confirmation preview did not include HTML")
        (args.output_dir / filename).write_text(html, encoding="utf-8")

    print(f"Wrote {len(previews)} previews to {args.output_dir}")


if __name__ == "__main__":
    main()
