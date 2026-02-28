from sqlmodel import SQLModel, create_engine, Session

import os
from app.config import DATABASE_URL, IS_DEV 

engine = create_engine(
    DATABASE_URL,
    echo=IS_DEV,
    pool_pre_ping=True
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
