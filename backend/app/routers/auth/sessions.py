from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.user_session import UserSession
from app.dependencies.auth import get_current_user


router = APIRouter()


# ────────────────────────────────────────────────────────────────────
#  Pydantic
# ────────────────────────────────────────────────────────────────────
class TokenCheckRequest(BaseModel):
    token: str


# ────────────────────────────────────────────────────────────────────
#  Session management
# ────────────────────────────────────────────────────────────────────
@router.post("/logout-all")
def logout_all(current_user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """
    Logout all sessions for the current user (except possibly the current one).
    Or you can choose to log out everything including current if you like.
    """
    db.query(UserSession).filter_by(user_id=current_user.id).delete()
    db.commit()
    return {"detail": "All sessions logged out."}


@router.get("/sessions")
def get_sessions(current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """
    Return a list of the current user's active sessions.
    """
    sessions = db.query(UserSession).filter_by(user_id=current_user.id).all()
    return [
        {
            "session_id": s.id,
            "token": s.token,
            "ip_address": s.ip_address,
            "client_name": s.client_name,
            "created_at": s.created_at,
            "last_accessed": s.last_accessed,
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: int,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """
    Revoke a specific session by ID (must belong to the current user).
    """
    session = db.query(UserSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    db.delete(session)
    db.commit()
    return {"detail": "Session revoked."}


@router.post("/check-session")
def check_session(payload: TokenCheckRequest, db: Session = Depends(get_db)):
    """
    Return {"valid": True} if the token is still in user_sessions table,
    otherwise {"valid": False}.
    """
    session = db.query(UserSession).filter_by(token=payload.token).first()
    return {"valid": session is not None}
