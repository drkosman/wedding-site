import csv
import io

from fastapi import APIRouter, Depends, UploadFile, File
from sqlmodel import Session, select
from fastapi.responses import StreamingResponse
from sqlalchemy import func

from app.database import get_session
from app.models import Guest, GuestRequest, RSVP
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
            "plus_one_allowed": guest.plus_one_allowed,
            "max_guests": guest.max_guests,
            "attending": rsvp.attending if rsvp else None,
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
        "plus_one_allowed",
        "max_guests",
        "attending",
        "dietary_requirements",
        "message",
        "updated_at",
    ])

    for guest, rsvp in results:
        writer.writerow([
            guest.id,
            guest.name,
            guest.email,
            guest.plus_one_allowed,
            guest.max_guests,
            rsvp.attending if rsvp else "",
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

    return {
        "total_guests": total_guests,
        "total_rsvps": total_rsvps,
        "attending": attending_count,
        "not_attending": not_attending_count,
    }
