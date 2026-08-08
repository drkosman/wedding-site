from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models import CONTENT_KINDS, ContentEntry, HomepageSection

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


def serialize_homepage_section(section: HomepageSection, *, include_timestamps: bool = False):
    serialized = {
        "id": section.id,
        "title": section.title,
        "subtitle": section.subtitle,
        "content": section.content,
        "position": section.position,
        "sort_order": section.sort_order,
    }
    if include_timestamps:
        serialized["created_at"] = section.created_at
        serialized["updated_at"] = section.updated_at
    return serialized


def list_homepage_sections(session: Session, *, include_timestamps: bool = False):
    sections = session.exec(
        select(HomepageSection).order_by(
            HomepageSection.position,
            HomepageSection.sort_order,
            HomepageSection.id,
        )
    ).all()
    return [
        serialize_homepage_section(section, include_timestamps=include_timestamps)
        for section in sections
    ]


@router.get("/content/{kind}")
def public_content_entries(
    kind: str,
    session: Session = Depends(get_session),
):
    return list_content_entries(kind, session)


@router.get("/homepage-sections")
def public_homepage_sections(session: Session = Depends(get_session)):
    return list_homepage_sections(session)
