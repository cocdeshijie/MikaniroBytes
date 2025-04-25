from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.system_settings import SystemSettings

router = APIRouter()


@router.get("/registration-enabled")
def registration_enabled(db: Session = Depends(get_db)):
    """
    Lightweight public endpoint.

    Returns: {"enabled": true/false}
    """
    s = db.query(SystemSettings).first()
    return {"enabled": bool(s.registration_enabled) if s else True}
