from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models import CONTENT_KINDS, ContentEntry

router = APIRouter(tags=["Content"])


def validate_content_kind(kind: str) -> str:
    if kind not in CONTENT_KINDS:
        raise HTTPException(status_code=404, detail="Content section not found")
    return kind


def serialize_content_entry(entry: ContentEntry):
    return {
        "id": entry.id,
        "kind": entry.kind,
        "sort_order": entry.sort_order,
        "title": entry.title,
        "description": entry.description,
        "date": entry.date,
        "time": entry.time,
        "location": entry.location,
        "notes": entry.notes,
        "address": entry.address,
        "price_notes": entry.price_notes,
        "distance": entry.distance,
        "website_url": entry.website_url,
        "updated_at": entry.updated_at,
    }


def list_content_entries(kind: str, session: Session):
    validate_content_kind(kind)
    entries = session.exec(
        select(ContentEntry)
        .where(ContentEntry.kind == kind)
        .order_by(ContentEntry.sort_order, ContentEntry.id)
    ).all()

    return [serialize_content_entry(entry) for entry in entries]


@router.get("/content/{kind}")
def public_content_entries(
    kind: str,
    session: Session = Depends(get_session),
):
    return list_content_entries(kind, session)
