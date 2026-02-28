from fastapi import Header, HTTPException

from app.config import ADMIN_SECRET

def verify_admin(x_admin_secret: str = Header(...)):
    if x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")