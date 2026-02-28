from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_db_and_tables
from app.routers import rsvp, admin
from app.config import IS_DEV

import os

if IS_DEV:
    app = FastAPI(docs_url=None, redoc_url=None)
else:
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
app.include_router(admin.router, prefix="/admin")

@app.get("/")
def health():
    return {"status": "ok"}