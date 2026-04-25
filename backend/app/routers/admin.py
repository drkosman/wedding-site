import csv
import io
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from fastapi.responses import StreamingResponse
from sqlalchemy import func

from app.database import get_session
from app.models import Guest, GuestRequest, InviteSentRequest, RSVP
from app.routers.utils import verify_admin

router = APIRouter(prefix="/admin", tags=["Admin"])

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
