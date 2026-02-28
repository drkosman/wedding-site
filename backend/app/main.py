from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_db_and_tables
from app.routers import rsvp

app = FastAPI()

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rsvp.router, prefix="/api")

@app.get("/")
def health():
    return {"status": "ok"}

def seed():
    with Session(engine) as session:
        guest = Guest(
            name="Alice Smith",
            email="alice@example.com",
            token=secrets.token_urlsafe(16),
            plus_one_allowed=True,
            max_guests=2,
        )
        session.add(guest)
        session.commit()