from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_db_and_tables
from .routers import rsvp, admin, content
from .config import CORS_ORIGINS, IS_DEV

if IS_DEV:
    app = FastAPI(docs_url=None, redoc_url=None)
else:
    app = FastAPI()

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rsvp.router, prefix="/api")
app.include_router(content.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"ok": True}
