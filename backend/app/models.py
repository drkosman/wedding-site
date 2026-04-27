from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from uuid import uuid4
from pydantic import BaseModel, field_validator
from urllib.parse import urlparse

class Guest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: Optional[str] = Field(default=None, index=True)
    token: str = Field(default_factory=lambda: str(uuid4()), index=True, unique=True)
    plus_one_allowed: bool = False
    max_guests: int = 1
    invite_sent: bool = False
    
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


class ContentEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str = Field(index=True)
    sort_order: int = Field(default=0, index=True)
    title: str
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    address: Optional[str] = None
    price_notes: Optional[str] = None
    distance: Optional[str] = None
    website_url: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


CONTENT_KINDS = {"schedule", "accommodation", "travel"}


def validate_content_url(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    trimmed = value.strip()
    if not trimmed:
        return None

    parsed = urlparse(trimmed)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Website URL must be a valid http or https URL")

    return trimmed

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


class InviteSentRequest(BaseModel):
    invite_sent: bool


class ContentEntryRequest(BaseModel):
    sort_order: Optional[int] = None
    title: str
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    address: Optional[str] = None
    price_notes: Optional[str] = None
    distance: Optional[str] = None
    website_url: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_is_required(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Title is required")
        return trimmed

    @field_validator(
        "description",
        "date",
        "time",
        "location",
        "notes",
        "address",
        "price_notes",
        "distance",
        mode="before",
    )
    @classmethod
    def empty_strings_to_none(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = str(value).strip()
        return trimmed or None

    @field_validator("website_url")
    @classmethod
    def website_url_is_valid(cls, value: Optional[str]) -> Optional[str]:
        return validate_content_url(value)


class ContentReorderRequest(BaseModel):
    ids: list[int]
