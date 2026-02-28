from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Guest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: Optional[str] = None
    token: str = Field(index=True, unique=True)
    plus_one_allowed: bool = False
    max_guests: int = 1


class RSVP(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    guest_id: int = Field(foreign_key="guest.id")
    attending: bool
    sunday_event: bool
    # guest_count: int = 1
    dietary_requirements: Optional[str] = None
    message: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
