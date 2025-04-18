from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.dependencies.auth import get_current_user
from app.db.database import get_db
from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.group_settings import GroupSettings
from app.db.models.system_settings import SystemSettings
from app.db.models.file import File
from app.db.models.user_session import UserSession

router = APIRouter()


def ensure_superadmin(user: User):
    """Helper: only SUPER_ADMIN can access these endpoints."""
    if not user.group or user.group.name != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can perform this action.")


class GroupCreate(BaseModel):
    name: str
    allowed_extensions: list[str] = ["jpg", "png", "gif"]
    max_file_size: int = 10_000_000
    max_storage_size: Optional[int] = None


class GroupRead(BaseModel):
    id: int
    name: str
    allowed_extensions: list[str]
    max_file_size: int
    max_storage_size: Optional[int]

    class Config:
        orm_mode = True


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    allowed_extensions: Optional[List[str]] = None
    max_file_size: Optional[int] = None
    max_storage_size: Optional[int] = None


@router.get("/groups", response_model=List[GroupRead])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    groups = db.query(Group).all()
    result = []
    for g in groups:
        if g.settings:
            result.append(GroupRead(
                id=g.id,
                name=g.name,
                allowed_extensions=g.settings.allowed_extensions,
                max_file_size=g.settings.max_file_size,
                max_storage_size=g.settings.max_storage_size
            ))
        else:
            result.append(GroupRead(
                id=g.id,
                name=g.name,
                allowed_extensions=[],
                max_file_size=0,
                max_storage_size=None
            ))
    return result


@router.post("/groups", response_model=GroupRead)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    existing = db.query(Group).filter(Group.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists.")

    new_group = Group(name=payload.name)
    new_settings = GroupSettings(
        allowed_extensions=payload.allowed_extensions,
        max_file_size=payload.max_file_size,
        max_storage_size=payload.max_storage_size,
    )
    new_group.settings = new_settings

    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return GroupRead(
        id=new_group.id,
        name=new_group.name,
        allowed_extensions=new_settings.allowed_extensions,
        max_file_size=new_settings.max_file_size,
        max_storage_size=new_settings.max_storage_size
    )


@router.put("/groups/{group_id}", response_model=GroupRead)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    db_group = db.query(Group).filter(Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found.")

    if db_group.name == "SUPER_ADMIN":
        if payload.name and payload.name != "SUPER_ADMIN":
            raise HTTPException(status_code=400, detail="Cannot rename SUPER_ADMIN group.")

    # update group name
    if payload.name and db_group.name != "SUPER_ADMIN":
        existing = db.query(Group).filter(Group.name == payload.name).first()
        if existing and existing.id != group_id:
            raise HTTPException(status_code=400, detail="Another group with that name exists.")
        db_group.name = payload.name

    # update settings
    settings = db_group.settings
    if not settings:
        settings = GroupSettings(group_id=db_group.id)
        db.add(settings)

    if payload.allowed_extensions is not None:
        settings.allowed_extensions = payload.allowed_extensions
    if payload.max_file_size is not None:
        settings.max_file_size = payload.max_file_size
    if payload.max_storage_size is not None:
        settings.max_storage_size = payload.max_storage_size

    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    db.refresh(settings)

    return GroupRead(
        id=db_group.id,
        name=db_group.name,
        allowed_extensions=settings.allowed_extensions,
        max_file_size=settings.max_file_size,
        max_storage_size=settings.max_storage_size
    )


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    delete_files: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    db_group = db.query(Group).filter(Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found.")

    if db_group.name == "SUPER_ADMIN":
        raise HTTPException(status_code=400, detail="Cannot delete the SUPER_ADMIN group.")

    # find user ids
    users_in_group = db.query(User).filter(User.group_id == group_id).all()
    user_ids = [u.id for u in users_in_group]

    if delete_files and user_ids:
        db.query(File).filter(File.user_id.in_(user_ids)).delete(synchronize_session=False)

    db.query(User).filter(User.group_id == group_id).delete(synchronize_session=False)

    db.delete(db_group)
    db.commit()

    return {"detail": f"Group '{db_group.name}' deleted. Users removed. Files_deleted={delete_files}"}


class SystemSettingsRead(BaseModel):
    registration_enabled: bool
    public_upload_enabled: bool
    default_user_group_id: Optional[int]


class SystemSettingsUpdate(BaseModel):
    registration_enabled: Optional[bool] = None
    public_upload_enabled: Optional[bool] = None
    default_user_group_id: Optional[int] = None


@router.get("/system-settings", response_model=SystemSettingsRead)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ensure_superadmin(current_user)

    settings = db.query(SystemSettings).first()
    if not settings:
        # If none, create one or return defaults
        return SystemSettingsRead(
            registration_enabled=True,
            public_upload_enabled=False,
            default_user_group_id=None
        )
    return SystemSettingsRead(
        registration_enabled=settings.registration_enabled,
        public_upload_enabled=settings.public_upload_enabled,
        default_user_group_id=settings.default_user_group_id,
    )


@router.put("/system-settings", response_model=SystemSettingsRead)
def update_system_settings(
    payload: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ensure_superadmin(current_user)

    settings = db.query(SystemSettings).first()
    if not settings:
        # create if missing
        settings = SystemSettings()
        db.add(settings)

    if payload.registration_enabled is not None:
        settings.registration_enabled = payload.registration_enabled

    if payload.public_upload_enabled is not None:
        settings.public_upload_enabled = payload.public_upload_enabled

    if payload.default_user_group_id is not None:
        # validate the group exists
        group = db.query(Group).filter(Group.id == payload.default_user_group_id).first()
        if not group:
            raise HTTPException(status_code=400, detail="Group with that ID not found.")
        settings.default_user_group_id = group.id

    db.add(settings)
    db.commit()
    db.refresh(settings)

    return SystemSettingsRead(
        registration_enabled=settings.registration_enabled,
        public_upload_enabled=settings.public_upload_enabled,
        default_user_group_id=settings.default_user_group_id
    )


class UserRead(BaseModel):
    id: int
    username: str
    email: Optional[str]
    group: Optional[dict]
    file_count: int
    storage_bytes: int

    class Config:
        orm_mode = True


class UserGroupUpdate(BaseModel):
    group_id: int


@router.get("/users", response_model=List[UserRead])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    users = db.query(User).all()
    rows: list[UserRead] = []
    for u in users:
        count, total = db.query(
            func.count(File.id),
            func.coalesce(func.sum(File.size), 0),
        ).filter(File.user_id == u.id).first()

        rows.append(
            UserRead(
                id=u.id,
                username=u.username,
                email=u.email,
                group={"id": u.group.id, "name": u.group.name} if u.group else None,
                file_count=count,
                storage_bytes=total,
            )
        )
    return rows


@router.put("/users/{user_id}/group", response_model=UserRead)
def update_user_group(
    user_id: int,
    payload: UserGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    target = db.query(User).filter_by(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.group and target.group.name == "SUPER_ADMIN":
        raise HTTPException(status_code=400, detail="Cannot modify SUPER_ADMIN.")

    new_group = db.query(Group).filter_by(id=payload.group_id).first()
    if not new_group:
        raise HTTPException(status_code=400, detail="Group not found.")
    if new_group.name == "SUPER_ADMIN":
        raise HTTPException(
            status_code=400,
            detail="Promoting to SUPER_ADMIN is not permitted.",
        )

    target.group_id = new_group.id
    db.add(target)
    db.commit()
    db.refresh(target)

    count, total = db.query(
        func.count(File.id),
        func.coalesce(func.sum(File.size), 0),
    ).filter(File.user_id == target.id).first()

    return UserRead(
        id=target.id,
        username=target.username,
        email=target.email,
        group={"id": new_group.id, "name": new_group.name},
        file_count=count,
        storage_bytes=total,
    )


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    delete_files: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a normal user and (optionally) their files.
    Sessions are removed explicitly first to avoid FK issues.
    """
    ensure_superadmin(current_user)

    target = db.query(User).filter_by(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.group and target.group.name == "SUPER_ADMIN":
        raise HTTPException(status_code=400, detail="Cannot delete SUPER_ADMIN.")

    # 1) remove sessions (prevents NOT‑NULL FK updates)
    db.query(UserSession).filter(UserSession.user_id == user_id).delete(
        synchronize_session=False
    )

    # 2) optionally delete files
    if delete_files:
        db.query(File).filter(File.user_id == user_id).delete(
            synchronize_session=False
        )

    # 3) finally delete user
    db.delete(target)
    db.commit()
    return {"detail": f"User {target.username} deleted.", "files_deleted": delete_files}
