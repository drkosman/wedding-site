from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..database import get_session
from ..models import Guest, RSVP, RSVPRequest, GuestRequest
from datetime import datetime

router = APIRouter()
   
@router.get("/guest/{token}")
def get_guest(token: str, session: Session = Depends(get_session)):
    statement = select(Guest).where(Guest.token == token)
    guest = session.exec(statement).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    rsvp = guest.rsvp

    return {
        "name": guest.name,
        "email": guest.email,
        "plus_one_allowed": guest.plus_one_allowed,
        "max_guests": guest.max_guests,
        "rsvp": {
            "attending": rsvp.attending,
            "guest_count": rsvp.guest_count,
            "sunday_event": rsvp.sunday_event,
            "hotel_reservation_requested": rsvp.hotel_reservation_requested,
            "friday_night": rsvp.friday_night,
            "saturday_night": rsvp.saturday_night,
            "sunday_night": rsvp.sunday_night,
            "dietary_requirements": rsvp.dietary_requirements,
            "message": rsvp.message,
        } if rsvp else None,
    }
    
@router.post("/rsvp/{token}")
def submit_rsvp(
    token: str,
    payload: RSVPRequest,
    session: Session = Depends(get_session),
):
    guest = session.exec(
        select(Guest).where(Guest.token == token)
    ).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

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
    else:
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

    session.commit()

    return {"status": "success"}
