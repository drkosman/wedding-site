import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session

from ..abuse import (
    fingerprint_client,
    get_client_ip,
    record_rate_limit_event,
    verify_turnstile,
)
from ..database import get_session
from ..models import PublicRSVPRequest, RSVP, utcnow
from ..rsvp_notifications import notify_guest_confirmation, notify_new_rsvp


router = APIRouter(tags=["RSVP"])
logger = logging.getLogger(__name__)


def create_public_rsvp(payload: PublicRSVPRequest, session: Session) -> RSVP:
    now = utcnow()
    rsvp = RSVP(
        submitted_name=payload.full_name,
        email=payload.email,
        attending=payload.attending,
        guest_count=payload.guest_count,
        additional_guest_names=payload.additional_guest_names,
        sunday_event=payload.sunday_event,
        hotel_reservation_requested=payload.hotel_reservation_requested,
        friday_night=payload.friday_night,
        saturday_night=payload.saturday_night,
        sunday_night=payload.sunday_night,
        dietaries=payload.dietaries,
        message=payload.message,
        created_at=now,
        updated_at=now,
    )
    session.add(rsvp)
    session.commit()
    session.refresh(rsvp)
    return rsvp


@router.post("/rsvps", status_code=status.HTTP_201_CREATED)
def submit_rsvp(
    payload: PublicRSVPRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    # Quietly accept the honeypot so simple bots do not learn how to bypass it.
    if payload.website:
        return {"status": "success"}

    client_ip = get_client_ip(request)
    record_rate_limit_event(session, fingerprint_client(client_ip))

    if not verify_turnstile(payload.turnstile_token, client_ip):
        raise HTTPException(
            status_code=400,
            detail="Verification failed. Please refresh the challenge and try again.",
        )

    rsvp = create_public_rsvp(payload, session)
    try:
        notify_new_rsvp(rsvp)
    except Exception as error:
        logger.error(
            "RSVP notification failed after persistence (rsvp_id=%s, error_type=%s)",
            rsvp.id,
            type(error).__name__,
        )
    try:
        notify_guest_confirmation(rsvp)
    except Exception as error:
        logger.error(
            "RSVP confirmation failed after persistence (rsvp_id=%s, error_type=%s)",
            rsvp.id,
            type(error).__name__,
        )
    return {"status": "success"}
