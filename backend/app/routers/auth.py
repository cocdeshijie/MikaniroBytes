import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies.auth import get_current_user
from app.db.models.user import User
from app.db.models.user_session import UserSession
from app.utils.security import verify_password, hash_password

router = APIRouter()


@router.post("/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    """
    Basic login with username and password.
    Generates a new session token if successful.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password.")

    if not user.hashed_password:
        raise HTTPException(status_code=400, detail="User has no password set.")

    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password.")

    # Create a new session record
    session_token = str(uuid.uuid4())
    new_session = UserSession(
        user_id=user.id,
        token=session_token
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return {
        "access_token": session_token,
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(token: str, db: Session = Depends(get_db)):
    """
    Logout by deleting the session corresponding to the given token.
    """
    session = db.query(UserSession).filter(UserSession.token == token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    db.delete(session)
    db.commit()
    return {"detail": "Logged out."}


@router.get("/sessions")
def get_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Return a list of the current user's active sessions.
    current_user dependency needs to check the token belongs to them.
    """
    # We'll define how to get current_user from a token in a separate function.
    sessions = db.query(UserSession).filter(UserSession.user_id == current_user.id).all()
    return [
        {
            "session_id": s.id,
            "token": s.token,
            "created_at": s.created_at,
            "last_accessed": s.last_accessed
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Revoke a specific session by ID (belongs to the current user).
    """
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    db.delete(session)
    db.commit()
    return {"detail": "Session revoked."}
