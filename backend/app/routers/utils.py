from hmac import compare_digest

from fastapi import Header, HTTPException

from app.config import ADMIN_SECRET

def verify_admin(x_admin_secret: str = Header(...)):
    if not ADMIN_SECRET or not compare_digest(x_admin_secret, ADMIN_SECRET):
        raise HTTPException(status_code=403, detail="Unauthorized")
