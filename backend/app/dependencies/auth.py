from datetime import datetime
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.user_session import UserSession


def get_current_user(
        request: Request,
        db: Session = Depends(get_db)
) -> User:
    """
    Extract the token from the Authorization header.
    Verify it corresponds to a valid session.
    Return the associated User.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid auth scheme")

    session = db.query(UserSession).filter(UserSession.token == token).first()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session user.")

    # Optionally update last_accessed
    session.last_accessed = datetime.now()
    db.add(session)
    db.commit()
    db.refresh(session)

    return user
