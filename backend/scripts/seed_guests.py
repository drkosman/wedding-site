from app.models import Guest
from app.database import engine
from sqlmodel import Session
import secrets

def seed():
    with Session(engine) as session:
        token = secrets.token_urlsafe(16)

        guest = Guest(
            name="Alice Smith",
            email="alice@example.com",
            token=token,
            plus_one_allowed=True,
            max_guests=2,
        )
        session.add(guest)
        session.commit()
        print(token)
        
seed()