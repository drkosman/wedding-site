from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from uuid import uuid4
from pydantic import BaseModel

class Guest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: Optional[str] = Field(default=None, index=True)
    token: str = Field(default_factory=lambda: str(uuid4()), index=True, unique=True)
    plus_one_allowed: bool = False
    max_guests: int = 1
    
    rsvp: Optional["RSVP"] = Relationship(back_populates="guest")


class RSVP(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    guest_id: int = Field(foreign_key="guest.id", unique=True)
    attending: bool
    sunday_event: bool = False
    guest_count: int = Field(default=1, ge=1)
    hotel_reservation_requested: bool = False
    friday_night: bool = False
    saturday_night: bool = False
    sunday_night: bool = False
    dietary_requirements: Optional[str] = None
    message: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    guest: Optional[Guest] = Relationship(back_populates="rsvp")

class RSVPRequest(BaseModel):
    attending: bool
    guest_count: int = Field(default=1, ge=1)
    sunday_event: bool = False
    hotel_reservation_requested: bool = False
    friday_night: bool = False
    saturday_night: bool = False
    sunday_night: bool = False
    dietary_requirements: Optional[str] = None
    message: Optional[str] = None
    
class GuestRequest(BaseModel):
    name: str
    email: Optional[str] = None
    plus_one_allowed: bool = False
    max_guests: int = 1
