from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.system_settings import SystemSettings
from app.db.models.group import Group
from app.dependencies.auth import get_current_user
from .helpers import ensure_superadmin, IMMUTABLE_GROUPS


router = APIRouter()


# Pydantic models
class SystemSettingsRead(BaseModel):
    registration_enabled: bool
    public_upload_enabled: bool
    default_user_group_id: Optional[int]
    upload_path_template: str


class SystemSettingsUpdate(BaseModel):
    registration_enabled: Optional[bool] = None
    public_upload_enabled: Optional[bool] = None
    default_user_group_id: Optional[int] = None
    upload_path_template: Optional[str] = None


@router.get("/system-settings", response_model=SystemSettingsRead)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: None = Depends(get_current_user),
):
    """
    Get global system settings. SUPER_ADMIN only.
    """
    ensure_superadmin(current_user)
    s = db.query(SystemSettings).first()
    if not s:
        return SystemSettingsRead(
            registration_enabled=True,
            public_upload_enabled=False,
            default_user_group_id=None,
            upload_path_template="{Y}/{m}",
        )
    return SystemSettingsRead(
        registration_enabled=s.registration_enabled,
        public_upload_enabled=s.public_upload_enabled,
        default_user_group_id=s.default_user_group_id,
        upload_path_template=s.upload_path_template,
    )


@router.put("/system-settings", response_model=SystemSettingsRead)
def update_system_settings(
    payload: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: None = Depends(get_current_user),
):
    """
    Update global system settings. SUPER_ADMIN only.
    """
    ensure_superadmin(current_user)

    s = db.query(SystemSettings).first() or SystemSettings()
    if payload.registration_enabled is not None:
        s.registration_enabled = payload.registration_enabled
    if payload.public_upload_enabled is not None:
        s.public_upload_enabled = payload.public_upload_enabled
    if payload.default_user_group_id is not None:
        grp = db.query(Group).filter(Group.id == payload.default_user_group_id).first()
        if not grp:
            raise HTTPException(status_code=400, detail="Group not found.")
        if grp.name in IMMUTABLE_GROUPS:
            raise HTTPException(
                status_code=400,
                detail=f"{grp.name} cannot be the default user group.",
            )
        s.default_user_group_id = grp.id
    if payload.upload_path_template is not None:
        # Basic sanity checks
        if payload.upload_path_template.startswith(("/", "\\")) or ".." in payload.upload_path_template:
            raise HTTPException(status_code=400, detail="Invalid path template.")
        s.upload_path_template = payload.upload_path_template.strip() or "{Y}/{m}"

    db.add(s)
    db.commit()
    db.refresh(s)

    return SystemSettingsRead(
        registration_enabled=s.registration_enabled,
        public_upload_enabled=s.public_upload_enabled,
        default_user_group_id=s.default_user_group_id,
        upload_path_template=s.upload_path_template,
    )
