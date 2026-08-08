from app.models import Guest
from app.database import engine
from sqlmodel import Session

def seed():
    with Session(engine) as session:
        guest = Guest(
            name="Example Invitation Party",
            email="guest@example.com",
            max_guests=2,
        )
        session.add(guest)
        session.commit()
        print("Created an example paper-invitation record.")
        
seed()
