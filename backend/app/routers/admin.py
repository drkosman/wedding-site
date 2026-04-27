import csv
import io
from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from fastapi.responses import StreamingResponse
from sqlalchemy import func

from ..database import get_session
from ..models import (
    ContentEntry,
    ContentEntryRequest,
    ContentReorderRequest,
    Guest,
    GuestRequest,
    InviteSentRequest,
    RSVP,
    RSVPRequest,
)
from .content import list_content_entries, serialize_content_entry, validate_content_kind
from .utils import verify_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


def upsert_guest_rsvp(session: Session, guest: Guest, payload: RSVPRequest):
    if payload.guest_count > guest.max_guests:
        raise HTTPException(
            status_code=400,
            detail=f"Guest count cannot exceed {guest.max_guests}",
        )

    existing = session.exec(
        select(RSVP).where(RSVP.guest_id == guest.id)
    ).first()

    if existing:
        existing.attending = payload.attending
        existing.guest_count = payload.guest_count
        existing.sunday_event = payload.sunday_event
        existing.hotel_reservation_requested = payload.hotel_reservation_requested
        existing.friday_night = payload.friday_night
        existing.saturday_night = payload.saturday_night
        existing.sunday_night = payload.sunday_night
        existing.dietary_requirements = payload.dietary_requirements
        existing.message = payload.message
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        return existing

    rsvp = RSVP(
        guest_id=guest.id,
        attending=payload.attending,
        guest_count=payload.guest_count,
        sunday_event=payload.sunday_event,
        hotel_reservation_requested=payload.hotel_reservation_requested,
        friday_night=payload.friday_night,
        saturday_night=payload.saturday_night,
        sunday_night=payload.sunday_night,
        dietary_requirements=payload.dietary_requirements,
        message=payload.message,
    )
    session.add(rsvp)
    return rsvp

@router.post("/guest")
def create_guest(
    payload: GuestRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    guest = Guest(
        name=payload.name,
        email=payload.email,
        token=str(uuid4()),
        plus_one_allowed=payload.plus_one_allowed,
        max_guests=payload.max_guests,
    )

    session.add(guest)
    session.commit()
    session.refresh(guest)

    return guest



@router.get("/guests")
def list_guests(
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    statement = select(Guest, RSVP).join(
        RSVP, RSVP.guest_id == Guest.id, isouter=True
    )

    results = session.exec(statement).all()

    output = []

    for guest, rsvp in results:
        output.append({
            "id": guest.id,
            "name": guest.name,
            "email": guest.email,
            "token": guest.token,
            "plus_one_allowed": guest.plus_one_allowed,
            "max_guests": guest.max_guests,
            "invite_sent": guest.invite_sent,
            "attending": rsvp.attending if rsvp else None,
            "guest_count": rsvp.guest_count if rsvp else None,
            "sunday_event": rsvp.sunday_event if rsvp else None,
            "hotel_reservation_requested": (
                rsvp.hotel_reservation_requested if rsvp else None
            ),
            "friday_night": rsvp.friday_night if rsvp else None,
            "saturday_night": rsvp.saturday_night if rsvp else None,
            "sunday_night": rsvp.sunday_night if rsvp else None,
            "dietary_requirements": rsvp.dietary_requirements if rsvp else None,
            "message": rsvp.message if rsvp else None,
            "updated_at": rsvp.updated_at if rsvp else None,
        })

    return output

@router.get("/guests/export")
def export_guests_csv(
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    statement = select(Guest, RSVP).join(
        RSVP, RSVP.guest_id == Guest.id, isouter=True
    )

    results = session.exec(statement).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "id",
        "name",
        "email",
        "token",
        "plus_one_allowed",
        "max_guests",
        "invite_sent",
        "attending",
        "guest_count",
        "sunday_event",
        "hotel_reservation_requested",
        "friday_night",
        "saturday_night",
        "sunday_night",
        "dietary_requirements",
        "message",
        "updated_at",
    ])

    for guest, rsvp in results:
        writer.writerow([
            guest.id,
            guest.name,
            guest.email,
            guest.token,
            guest.plus_one_allowed,
            guest.max_guests,
            guest.invite_sent,
            rsvp.attending if rsvp else "",
            rsvp.guest_count if rsvp else "",
            rsvp.sunday_event if rsvp else "",
            rsvp.hotel_reservation_requested if rsvp else "",
            rsvp.friday_night if rsvp else "",
            rsvp.saturday_night if rsvp else "",
            rsvp.sunday_night if rsvp else "",
            rsvp.dietary_requirements if rsvp else "",
            rsvp.message if rsvp else "",
            rsvp.updated_at if rsvp else "",
        ])

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=guests.csv"
        },
    )
    

@router.patch("/guest/{guest_id}/invite-sent")
def update_guest_invite_sent(
    guest_id: int,
    payload: InviteSentRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    guest = session.get(Guest, guest_id)

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    guest.invite_sent = payload.invite_sent
    session.add(guest)
    session.commit()
    session.refresh(guest)

    return {
        "id": guest.id,
        "invite_sent": guest.invite_sent,
    }


@router.put("/guest/{guest_id}/rsvp")
def admin_upsert_rsvp(
    guest_id: int,
    payload: RSVPRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    guest = session.get(Guest, guest_id)

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    rsvp = upsert_guest_rsvp(session, guest, payload)
    session.commit()
    session.refresh(rsvp)

    return {
        "id": rsvp.id,
        "guest_id": rsvp.guest_id,
        "updated_at": rsvp.updated_at,
    }


@router.delete("/guest/{guest_id}/rsvp")
def admin_delete_rsvp(
    guest_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    guest = session.get(Guest, guest_id)

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    existing = session.exec(
        select(RSVP).where(RSVP.guest_id == guest.id)
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="RSVP not found")

    session.delete(existing)
    session.commit()

    return {"status": "deleted"}


@router.delete("/guest/{guest_id}")
def delete_guest(
    guest_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    guest = session.get(Guest, guest_id)

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    existing = session.exec(
        select(RSVP).where(RSVP.guest_id == guest.id)
    ).first()

    if existing:
        session.delete(existing)

    session.delete(guest)
    session.commit()

    return {"status": "deleted"}


@router.post("/guests/bulk")
def bulk_upload_guests(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    contents = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(contents))

    created = 0

    for row in reader:
        guest = Guest(
            name=row["name"],
            email=row.get("email"),
            token=str(uuid4()),
            plus_one_allowed=row.get("plus_one_allowed", "false").lower() == "true",
            max_guests=int(row.get("max_guests", 1)),
        )
        session.add(guest)
        created += 1

    session.commit()

    return {"created": created}


def apply_content_payload(entry: ContentEntry, payload: ContentEntryRequest):
    entry.title = payload.title
    entry.description = payload.description
    entry.date = payload.date
    entry.time = payload.time
    entry.location = payload.location
    entry.notes = payload.notes
    entry.address = payload.address
    entry.price_notes = payload.price_notes
    entry.distance = payload.distance
    entry.website_url = payload.website_url
    entry.updated_at = datetime.utcnow()

    if payload.sort_order is not None:
        entry.sort_order = payload.sort_order

    return entry


def next_content_sort_order(session: Session, kind: str) -> int:
    current_max = session.exec(
        select(func.max(ContentEntry.sort_order)).where(ContentEntry.kind == kind)
    ).one()

    return 0 if current_max is None else current_max + 1


@router.get("/content/{kind}")
def admin_list_content(
    kind: str,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    return list_content_entries(kind, session)


@router.post("/content/{kind}")
def admin_create_content(
    kind: str,
    payload: ContentEntryRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    validate_content_kind(kind)
    sort_order = (
        payload.sort_order
        if payload.sort_order is not None
        else next_content_sort_order(session, kind)
    )
    entry = ContentEntry(kind=kind, sort_order=sort_order, title=payload.title)
    apply_content_payload(entry, payload)
    entry.sort_order = sort_order

    session.add(entry)
    session.commit()
    session.refresh(entry)

    return serialize_content_entry(entry)


@router.put("/content/{kind}/reorder")
def admin_reorder_content(
    kind: str,
    payload: ContentReorderRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    validate_content_kind(kind)
    entries = session.exec(
        select(ContentEntry).where(ContentEntry.kind == kind)
    ).all()
    entries_by_id = {entry.id: entry for entry in entries}

    if len(payload.ids) != len(set(payload.ids)):
        raise HTTPException(status_code=400, detail="Duplicate content entry IDs are not allowed")

    if len(payload.ids) != len(entries):
        raise HTTPException(status_code=400, detail="Reorder list must include every entry")

    missing_ids = [entry_id for entry_id in payload.ids if entry_id not in entries_by_id]
    if missing_ids:
        raise HTTPException(status_code=400, detail="Reorder list contains unknown entries")

    for sort_order, entry_id in enumerate(payload.ids):
        entry = entries_by_id[entry_id]
        entry.sort_order = sort_order
        entry.updated_at = datetime.utcnow()
        session.add(entry)

    session.commit()

    return list_content_entries(kind, session)


@router.put("/content/{kind}/{entry_id}")
def admin_update_content(
    kind: str,
    entry_id: int,
    payload: ContentEntryRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    validate_content_kind(kind)
    entry = session.get(ContentEntry, entry_id)

    if not entry or entry.kind != kind:
        raise HTTPException(status_code=404, detail="Content entry not found")

    apply_content_payload(entry, payload)
    session.add(entry)
    session.commit()
    session.refresh(entry)

    return serialize_content_entry(entry)


@router.delete("/content/{kind}/{entry_id}")
def admin_delete_content(
    kind: str,
    entry_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    validate_content_kind(kind)
    entry = session.get(ContentEntry, entry_id)

    if not entry or entry.kind != kind:
        raise HTTPException(status_code=404, detail="Content entry not found")

    session.delete(entry)
    session.commit()

    remaining_entries = session.exec(
        select(ContentEntry)
        .where(ContentEntry.kind == kind)
        .order_by(ContentEntry.sort_order, ContentEntry.id)
    ).all()

    for sort_order, remaining_entry in enumerate(remaining_entries):
        remaining_entry.sort_order = sort_order
        session.add(remaining_entry)

    session.commit()

    return {"status": "deleted"}


@router.get("/summary")
def admin_summary(
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    total_guests = session.exec(
        select(func.count()).select_from(Guest)
    ).one()

    total_rsvps = session.exec(
        select(func.count()).select_from(RSVP)
    ).one()

    attending_count = session.exec(
        select(func.count()).where(RSVP.attending == True)
    ).one()

    not_attending_count = session.exec(
        select(func.count()).where(RSVP.attending == False)
    ).one()

    sunday_count = session.exec(
        select(func.count()).where(RSVP.sunday_event == True)
    ).one()

    hotel_request_count = session.exec(
        select(func.count()).where(RSVP.hotel_reservation_requested == True)
    ).one()

    return {
        "total_guests": total_guests,
        "total_rsvps": total_rsvps,
        "attending": attending_count,
        "not_attending": not_attending_count,
        "sunday_event": sunday_count,
        "hotel_reservation_requests": hotel_request_count,
    }
