import csv
import io
from collections import Counter

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlmodel import Session, select

from ..database import get_session
from ..models import (
    AdminRSVPRequest,
    ContentEntry,
    ContentEntryRequest,
    ContentReorderRequest,
    Guest,
    GuestRequest,
    InviteSentRequest,
    ReconcileRSVPRequest,
    RSVP,
    utcnow,
)
from .content import list_content_entries, serialize_content_entry, validate_content_kind
from .utils import verify_admin


router = APIRouter(prefix="/admin", tags=["Admin"])


def csv_safe(value):
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{value}"
    return value


def apply_rsvp_payload(rsvp: RSVP, payload: AdminRSVPRequest) -> RSVP:
    rsvp.guest_id = payload.guest_id
    rsvp.submitted_name = payload.full_name
    rsvp.email = payload.email
    rsvp.attending = payload.attending
    rsvp.guest_count = payload.guest_count
    rsvp.additional_guest_names = payload.additional_guest_names
    rsvp.sunday_event = payload.sunday_event
    rsvp.hotel_reservation_requested = payload.hotel_reservation_requested
    rsvp.friday_night = payload.friday_night
    rsvp.saturday_night = payload.saturday_night
    rsvp.sunday_night = payload.sunday_night
    rsvp.dietary_requirements = payload.dietary_requirements
    rsvp.message = payload.message
    rsvp.updated_at = utcnow()
    return rsvp


def validate_reconciliation(
    session: Session,
    guest_id: int | None,
    guest_count: int,
) -> Guest | None:
    if guest_id is None:
        return None

    guest = session.get(Guest, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Invitation record not found")
    if guest_count > guest.max_guests:
        raise HTTPException(
            status_code=400,
            detail=f"Guest count exceeds the invitation party size of {guest.max_guests}",
        )
    return guest


@router.post("/guest")
def create_guest(
    payload: GuestRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    guest = Guest(
        name=payload.name,
        email=payload.email,
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
    guests = session.exec(select(Guest).order_by(Guest.name, Guest.id)).all()
    matched_counts = dict(
        session.exec(
            select(RSVP.guest_id, func.count(RSVP.id))
            .where(RSVP.guest_id.is_not(None))
            .group_by(RSVP.guest_id)
        ).all()
    )
    return [
        {
            "id": guest.id,
            "name": guest.name,
            "email": guest.email,
            "max_guests": guest.max_guests,
            "invite_sent": guest.invite_sent,
            "matched_rsvp_count": matched_counts.get(guest.id, 0),
        }
        for guest in guests
    ]


@router.get("/rsvps")
def list_rsvps(
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    rows = session.exec(
        select(RSVP, Guest)
        .join(Guest, Guest.id == RSVP.guest_id, isouter=True)
        .order_by(RSVP.created_at.desc(), RSVP.id.desc())
    ).all()
    email_counts = Counter(rsvp.email for rsvp, _guest in rows)

    return [
        {
            "id": rsvp.id,
            "guest_id": rsvp.guest_id,
            "matched_guest_name": guest.name if guest else None,
            "invitation_max_guests": guest.max_guests if guest else None,
            "submitted_name": rsvp.submitted_name,
            "email": rsvp.email,
            "attending": rsvp.attending,
            "guest_count": rsvp.guest_count,
            "additional_guest_names": rsvp.additional_guest_names,
            "sunday_event": rsvp.sunday_event,
            "hotel_reservation_requested": rsvp.hotel_reservation_requested,
            "friday_night": rsvp.friday_night,
            "saturday_night": rsvp.saturday_night,
            "sunday_night": rsvp.sunday_night,
            "dietary_requirements": rsvp.dietary_requirements,
            "message": rsvp.message,
            "created_at": rsvp.created_at,
            "updated_at": rsvp.updated_at,
            "same_email_submission_count": email_counts[rsvp.email],
        }
        for rsvp, guest in rows
    ]


def csv_response(output: io.StringIO, filename: str) -> StreamingResponse:
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/guests/export")
def export_guests_csv(
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    guests = session.exec(select(Guest).order_by(Guest.name, Guest.id)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "name", "email", "max_guests", "invite_sent"])
    for guest in guests:
        writer.writerow(
            [
                guest.id,
                csv_safe(guest.name),
                csv_safe(guest.email),
                guest.max_guests,
                guest.invite_sent,
            ]
        )
    return csv_response(output, "guests.csv")


@router.get("/rsvps/export")
def export_rsvps_csv(
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    rows = session.exec(
        select(RSVP, Guest)
        .join(Guest, Guest.id == RSVP.guest_id, isouter=True)
        .order_by(RSVP.created_at.desc(), RSVP.id.desc())
    ).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "submitted_name",
            "email",
            "matched_guest_id",
            "matched_guest_name",
            "attending",
            "guest_count",
            "additional_guest_names",
            "sunday_event",
            "hotel_reservation_requested",
            "friday_night",
            "saturday_night",
            "sunday_night",
            "dietary_requirements",
            "message",
            "created_at",
            "updated_at",
        ]
    )
    for rsvp, guest in rows:
        writer.writerow(
            [
                rsvp.id,
                csv_safe(rsvp.submitted_name),
                csv_safe(rsvp.email),
                rsvp.guest_id,
                csv_safe(guest.name) if guest else "",
                rsvp.attending,
                rsvp.guest_count,
                csv_safe(rsvp.additional_guest_names),
                rsvp.sunday_event,
                rsvp.hotel_reservation_requested,
                rsvp.friday_night,
                rsvp.saturday_night,
                rsvp.sunday_night,
                csv_safe(rsvp.dietary_requirements),
                csv_safe(rsvp.message),
                rsvp.created_at,
                rsvp.updated_at,
            ]
        )
    return csv_response(output, "rsvps.csv")


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
    return {"id": guest.id, "invite_sent": guest.invite_sent}


@router.put("/rsvp/{rsvp_id}")
def admin_update_rsvp(
    rsvp_id: int,
    payload: AdminRSVPRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    rsvp = session.get(RSVP, rsvp_id)
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")
    validate_reconciliation(session, payload.guest_id, payload.guest_count)
    apply_rsvp_payload(rsvp, payload)
    session.add(rsvp)
    session.commit()
    session.refresh(rsvp)
    return {"id": rsvp.id, "guest_id": rsvp.guest_id, "updated_at": rsvp.updated_at}


@router.patch("/rsvp/{rsvp_id}/reconcile")
def reconcile_rsvp(
    rsvp_id: int,
    payload: ReconcileRSVPRequest,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    rsvp = session.get(RSVP, rsvp_id)
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")
    validate_reconciliation(session, payload.guest_id, rsvp.guest_count)
    rsvp.guest_id = payload.guest_id
    rsvp.updated_at = utcnow()
    session.add(rsvp)
    session.commit()
    return {"id": rsvp.id, "guest_id": rsvp.guest_id}


@router.delete("/rsvp/{rsvp_id}")
def admin_delete_rsvp(
    rsvp_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    rsvp = session.get(RSVP, rsvp_id)
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")
    session.delete(rsvp)
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

    linked_rsvps = session.exec(select(RSVP).where(RSVP.guest_id == guest.id)).all()
    for rsvp in linked_rsvps:
        rsvp.guest_id = None
        rsvp.updated_at = utcnow()
        session.add(rsvp)
    session.delete(guest)
    session.commit()
    return {"status": "deleted"}


@router.post("/guests/bulk")
def bulk_upload_guests(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin),
):
    try:
        contents = file.file.read().decode("utf-8")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=400, detail="CSV must use UTF-8 encoding") from error
    reader = csv.DictReader(io.StringIO(contents))
    if not reader.fieldnames or "name" not in reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV must include a name column")

    created = 0
    for row in reader:
        payload = GuestRequest(
            name=row.get("name", ""),
            email=row.get("email"),
            max_guests=row.get("max_guests") or 1,
        )
        session.add(
            Guest(name=payload.name, email=payload.email, max_guests=payload.max_guests)
        )
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
    entry.updated_at = utcnow()
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
    sort_order = payload.sort_order if payload.sort_order is not None else next_content_sort_order(session, kind)
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
    entries = session.exec(select(ContentEntry).where(ContentEntry.kind == kind)).all()
    entries_by_id = {entry.id: entry for entry in entries}
    if len(payload.ids) != len(set(payload.ids)):
        raise HTTPException(status_code=400, detail="Duplicate content entry IDs are not allowed")
    if len(payload.ids) != len(entries):
        raise HTTPException(status_code=400, detail="Reorder list must include every entry")
    if any(entry_id not in entries_by_id for entry_id in payload.ids):
        raise HTTPException(status_code=400, detail="Reorder list contains unknown entries")
    for sort_order, entry_id in enumerate(payload.ids):
        entry = entries_by_id[entry_id]
        entry.sort_order = sort_order
        entry.updated_at = utcnow()
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
    def count_where(*criteria):
        return session.exec(select(func.count()).select_from(RSVP).where(*criteria)).one()

    return {
        "total_guests": session.exec(select(func.count()).select_from(Guest)).one(),
        "total_rsvps": count_where(),
        "matched_rsvps": count_where(RSVP.guest_id.is_not(None)),
        "unmatched_rsvps": count_where(RSVP.guest_id.is_(None)),
        "attending": count_where(RSVP.attending == True),
        "not_attending": count_where(RSVP.attending == False),
        "sunday_event": count_where(RSVP.sunday_event == True),
        "hotel_reservation_requests": count_where(RSVP.hotel_reservation_requested == True),
    }
