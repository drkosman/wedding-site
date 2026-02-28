from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models import Guest, RSVP
from datetime import datetime

router = APIRouter()

@router.get("/guest/{token}")
def get_guest(token: str, session: Session = Depends(get_session)):
    statement = select(Guest).where(Guest.token == token)
    guest = session.exec(statement).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    return {
        "name": guest.name,
        "email": guest.email,
        "plus_one_allowed": guest.plus_one_allowed,
        "max_guests": guest.max_guests,
    }
    
@router.post("/rsvp/{token}")
def submit_rsvp(
    token: str,
    payload: dict,
    session: Session = Depends(get_session),
):
    statement = select(Guest).where(Guest.token == token)
    guest = session.exec(statement).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Check if RSVP exists already
    existing = session.exec(
        select(RSVP).where(RSVP.guest_id == guest.id)
    ).first()

    if existing:
        existing.attending = payload.get("attending")
        existing.guest_count = payload.get("guest_count", 1)
        existing.dietary_requirements = payload.get("dietary_requirements")
        existing.message = payload.get("message")
        existing.updated_at = datetime.utcnow()
        session.add(existing)
    else:
        rsvp = RSVP(
            guest_id=guest.id,
            attending=payload.get("attending"),
            guest_count=payload.get("guest_count", 1),
            dietary_requirements=payload.get("dietary_requirements"),
            message=payload.get("message"),
        )
        session.add(rsvp)

    session.commit()

    return {"status": "success"}
