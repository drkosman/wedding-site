from datetime import datetime, timezone
import re
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from sqlmodel import Field, Relationship, SQLModel


PUBLIC_MAX_GUESTS = 6
NAME_MAX_LENGTH = 160
EMAIL_MAX_LENGTH = 254
ADDITIONAL_GUESTS_MAX_LENGTH = 600
DIETARY_MAX_LENGTH = 1000
MESSAGE_MAX_LENGTH = 2000
EMAIL_LOCAL_PATTERN = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$")
EMAIL_DOMAIN_LABEL_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_optional_text(value: object) -> Optional[str]:
    if value is None:
        return None
    trimmed = str(value).strip()
    return trimmed or None


def normalize_email(value: object) -> str:
    email = str(value).strip().lower()
    if len(email) > EMAIL_MAX_LENGTH:
        raise ValueError("Email address is too long")

    local, separator, domain = email.rpartition("@")
    if (
        not separator
        or not local
        or not domain
        or len(local) > 64
        or "." not in domain
        or domain.startswith(".")
        or domain.endswith(".")
        or any(character.isspace() for character in email)
        or not EMAIL_LOCAL_PATTERN.fullmatch(local)
        or local.startswith(".")
        or local.endswith(".")
        or ".." in local
        or any(
            not EMAIL_DOMAIN_LABEL_PATTERN.fullmatch(label)
            for label in domain.split(".")
        )
    ):
        raise ValueError("Enter a valid email address")

    return email


class Guest(SQLModel, table=True):
    """Private paper-invitation record used only by administrators."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=NAME_MAX_LENGTH)
    email: Optional[str] = Field(default=None, max_length=EMAIL_MAX_LENGTH, index=True)
    max_guests: int = Field(default=1, ge=1, le=12)
    invite_sent: bool = False

    rsvps: list["RSVP"] = Relationship(back_populates="guest")


class RSVP(SQLModel, table=True):
    """A self-identifying public submission, optionally reconciled by an admin."""

    id: Optional[int] = Field(default=None, primary_key=True)
    guest_id: Optional[int] = Field(default=None, foreign_key="guest.id", index=True)
    submitted_name: str = Field(max_length=NAME_MAX_LENGTH, index=True)
    email: str = Field(max_length=EMAIL_MAX_LENGTH, index=True)
    attending: bool
    guest_count: int = Field(default=1, ge=1, le=PUBLIC_MAX_GUESTS)
    additional_guest_names: Optional[str] = Field(
        default=None,
        max_length=ADDITIONAL_GUESTS_MAX_LENGTH,
    )
    sunday_event: bool = False
    hotel_reservation_requested: bool = False
    friday_night: bool = False
    saturday_night: bool = False
    sunday_night: bool = False
    dietary_requirements: Optional[str] = Field(default=None, max_length=DIETARY_MAX_LENGTH)
    message: Optional[str] = Field(default=None, max_length=MESSAGE_MAX_LENGTH)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow)

    guest: Optional[Guest] = Relationship(back_populates="rsvps")


class RSVPRateLimitEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_fingerprint: str = Field(max_length=64, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)


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
    updated_at: datetime = Field(default_factory=utcnow)


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


class RSVPDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=2, max_length=NAME_MAX_LENGTH)
    email: str = Field(max_length=EMAIL_MAX_LENGTH)
    attending: bool
    guest_count: int = Field(default=1, ge=1, le=PUBLIC_MAX_GUESTS)
    additional_guest_names: Optional[str] = Field(
        default=None,
        max_length=ADDITIONAL_GUESTS_MAX_LENGTH,
    )
    sunday_event: bool = False
    hotel_reservation_requested: bool = False
    friday_night: bool = False
    saturday_night: bool = False
    sunday_night: bool = False
    dietary_requirements: Optional[str] = Field(default=None, max_length=DIETARY_MAX_LENGTH)
    message: Optional[str] = Field(default=None, max_length=MESSAGE_MAX_LENGTH)

    @field_validator("full_name")
    @classmethod
    def full_name_is_required(cls, value: str) -> str:
        trimmed = " ".join(value.split())
        if len(trimmed) < 2:
            raise ValueError("Full name is required")
        return trimmed

    @field_validator("email")
    @classmethod
    def email_is_valid(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator(
        "additional_guest_names",
        "dietary_requirements",
        "message",
        mode="before",
    )
    @classmethod
    def optional_text_is_trimmed(cls, value: object) -> Optional[str]:
        return normalize_optional_text(value)

    @model_validator(mode="after")
    def choices_are_consistent(self):
        if not self.attending:
            if self.guest_count != 1:
                raise ValueError("Guest count must be 1 when not attending")
            if self.additional_guest_names:
                raise ValueError("Additional guests are only accepted when attending")
            if self.sunday_event or self.hotel_reservation_requested:
                raise ValueError("Attendance-dependent choices require wedding attendance")
            if self.friday_night or self.saturday_night or self.sunday_night:
                raise ValueError("Room nights require wedding attendance")
            if self.dietary_requirements:
                raise ValueError("Dietary requirements are only accepted when attending")
            return self

        if self.guest_count > 1 and not self.additional_guest_names:
            raise ValueError("Please provide the names of additional guests")
        if self.guest_count == 1 and self.additional_guest_names:
            raise ValueError("Additional guest names require a guest count above 1")
        if not self.hotel_reservation_requested and (
            self.friday_night or self.saturday_night or self.sunday_night
        ):
            raise ValueError("Room nights require a hotel request")
        if self.hotel_reservation_requested and not (
            self.friday_night or self.saturday_night or self.sunday_night
        ):
            raise ValueError("Select at least one requested room night")
        return self


class PublicRSVPRequest(RSVPDetails):
    turnstile_token: str = Field(min_length=1, max_length=2048)
    website: str = Field(default="", max_length=200)


class AdminRSVPRequest(RSVPDetails):
    guest_id: Optional[int] = None


class ReconcileRSVPRequest(BaseModel):
    guest_id: Optional[int] = None


class GuestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=NAME_MAX_LENGTH)
    email: Optional[str] = Field(default=None, max_length=EMAIL_MAX_LENGTH)
    max_guests: int = Field(default=1, ge=1, le=12)

    @field_validator("name")
    @classmethod
    def name_is_required(cls, value: str) -> str:
        trimmed = " ".join(value.split())
        if len(trimmed) < 2:
            raise ValueError("Guest name is required")
        return trimmed

    @field_validator("email", mode="before")
    @classmethod
    def optional_email_is_valid(cls, value: object) -> Optional[str]:
        trimmed = normalize_optional_text(value)
        return normalize_email(trimmed) if trimmed else None


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
        return normalize_optional_text(value)

    @field_validator("website_url")
    @classmethod
    def website_url_is_valid(cls, value: Optional[str]) -> Optional[str]:
        return validate_content_url(value)


class ContentReorderRequest(BaseModel):
    ids: list[int]
