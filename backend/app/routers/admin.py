from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import os

from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.group_settings import GroupSettings
from app.db.models.system_settings import SystemSettings
from app.db.models.file import File
from app.db.models.user_session import UserSession
from app.dependencies.auth import get_current_user
from app.routers.files import MyFileItem, disk_path

router = APIRouter()

# ────────────────────────────────────────────────────────────────────
#  constants / helpers
# ────────────────────────────────────────────────────────────────────
IMMUTABLE_GROUPS: set[str] = {"SUPER_ADMIN", "GUEST"}


def ensure_superadmin(user: User) -> None:
    if not user.group or user.group.name != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN allowed")


def get_guest_user(db: Session) -> User:
    guest = (
        db.query(User)
        .join(Group, Group.id == User.group_id)
        .filter(Group.name == "GUEST", User.username == "guest")
        .first()
    )
    if not guest:
        raise HTTPException(
            status_code=500,
            detail="Guest user missing – did you run init_db() on start‑up?",
        )
    return guest


def delete_physical_files(file_rows: List[File]) -> int:
    """
    Delete the files on disk referenced by *file_rows*.
    Returns number of files attempted.
    """
    count = 0
    for f in file_rows:
        rel = f.storage_data.get("path", "")
        abs_path = disk_path(rel)
        if abs_path and os.path.isfile(abs_path):
            try:
                os.remove(abs_path)
            except OSError:
                pass
        count += 1
    return count


# ────────────────────────────────────────────────────────────────────
#  Pydantic models
# ────────────────────────────────────────────────────────────────────
class GroupCreate(BaseModel):
    name: str
    allowed_extensions: Optional[List[str]] = None
    max_file_size: Optional[int] = None
    max_storage_size: Optional[int] = None


class GroupRead(BaseModel):
    id: int
    name: str
    allowed_extensions: List[str]
    max_file_size: Optional[int]
    max_storage_size: Optional[int]
    file_count: int
    storage_bytes: int

    class Config:
        from_attributes = True  # pydantic‑v2


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    allowed_extensions: Optional[List[str]] = None
    max_file_size: Optional[int] = None
    max_storage_size: Optional[int] = None


class UserRead(BaseModel):
    id: int
    username: str
    email: Optional[str]
    group: Optional[dict]
    file_count: int
    storage_bytes: int

    class Config:
        from_attributes = True


class UserGroupUpdate(BaseModel):
    group_id: int


class SystemSettingsRead(BaseModel):
    registration_enabled: bool
    public_upload_enabled: bool
    default_user_group_id: Optional[int]


class SystemSettingsUpdate(BaseModel):
    registration_enabled: Optional[bool] = None
    public_upload_enabled: Optional[bool] = None
    default_user_group_id: Optional[int] = None


# ────────────────────────────────────────────────────────────────────
#  Groups API
# ────────────────────────────────────────────────────────────────────
@router.get("/groups", response_model=List[GroupRead])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    rows = (
        db.query(Group)
        .outerjoin(User, User.group_id == Group.id)
        .outerjoin(File, File.user_id == User.id)
        .add_columns(
            func.count(File.id).label("cnt"),
            func.coalesce(func.sum(File.size), 0).label("bytes"),
        )
        .group_by(Group.id)
        .all()
    )

    out: list[GroupRead] = []
    for grp, cnt, bytes_ in rows:
        sett = grp.settings
        out.append(
            GroupRead(
                id=grp.id,
                name=grp.name,
                allowed_extensions=sett.allowed_extensions if sett else [],
                max_file_size=sett.max_file_size if sett else None,
                max_storage_size=sett.max_storage_size if sett else None,
                file_count=cnt,
                storage_bytes=bytes_,
            )
        )
    return out


@router.post("/groups", response_model=GroupRead)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    if payload.name in IMMUTABLE_GROUPS:
        raise HTTPException(status_code=400, detail="Reserved group name.")
    if db.query(Group).filter(Group.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Group exists.")

    grp = Group(name=payload.name)
    grp.settings = GroupSettings(
        allowed_extensions=payload.allowed_extensions or [],
        max_file_size=payload.max_file_size or 10_000_000,
        max_storage_size=payload.max_storage_size,
    )
    db.add(grp)
    db.commit()
    db.refresh(grp)

    return GroupRead(
        id=grp.id,
        name=grp.name,
        allowed_extensions=grp.settings.allowed_extensions,
        max_file_size=grp.settings.max_file_size,
        max_storage_size=grp.settings.max_storage_size,
        file_count=0,
        storage_bytes=0,
    )


@router.put("/groups/{group_id}", response_model=GroupRead)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    grp = db.query(Group).filter(Group.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found.")

    # ── name change ───────────────────────────────────────────────
    if payload.name and payload.name != grp.name:
        if grp.name in IMMUTABLE_GROUPS:
            raise HTTPException(status_code=400, detail="Cannot rename built‑in group.")
        if payload.name in IMMUTABLE_GROUPS:
            raise HTTPException(status_code=400, detail="Reserved name.")
        dup = db.query(Group).filter(Group.name == payload.name).first()
        if dup and dup.id != group_id:
            raise HTTPException(status_code=400, detail="Name in use.")
        grp.name = payload.name

    # ── limits / ext list ─────────────────────────────────────────
    sett = grp.settings or GroupSettings(group_id=grp.id)
    if payload.allowed_extensions is not None:
        sett.allowed_extensions = payload.allowed_extensions
    if payload.max_file_size is not None:
        sett.max_file_size = payload.max_file_size
    if payload.max_storage_size is not None:
        sett.max_storage_size = payload.max_storage_size

    db.add_all([grp, sett])
    db.commit()
    db.refresh(grp)

    cnt, bytes_ = (
        db.query(
            func.count(File.id),
            func.coalesce(func.sum(File.size), 0),
        )
        .join(User, User.id == File.user_id)
        .filter(User.group_id == grp.id)
        .first()
    )

    return GroupRead(
        id=grp.id,
        name=grp.name,
        allowed_extensions=sett.allowed_extensions,
        max_file_size=sett.max_file_size,
        max_storage_size=sett.max_storage_size,
        file_count=cnt,
        storage_bytes=bytes_,
    )


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    delete_files: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a group.

    • SUPER_ADMIN and GUEST are protected
    • `delete_files=true` ⇒ remove physical files and DB rows
    • otherwise           ⇒ files reassigned to guest user
    """
    ensure_superadmin(current_user)

    grp = db.query(Group).filter(Group.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found.")
    if grp.name in IMMUTABLE_GROUPS:
        raise HTTPException(status_code=400, detail=f"Cannot delete {grp.name}.")

    # at least one normal group must remain
    remaining = (
        db.query(func.count(Group.id))
        .filter(Group.id != group_id, ~Group.name.in_(IMMUTABLE_GROUPS))
        .scalar()
    )
    if remaining == 0:
        raise HTTPException(
            status_code=400, detail="At least one non‑admin group must remain."
        )

    # fix default group if needed
    settings = db.query(SystemSettings).first()
    if settings and settings.default_user_group_id == group_id:
        fallback = (
            db.query(Group)
            .filter(Group.id != group_id, ~Group.name.in_(IMMUTABLE_GROUPS))
            .order_by(desc(Group.id))
            .first()
        )
        settings.default_user_group_id = fallback.id if fallback else None
        db.add(settings)

    # collect users
    uid_list = [uid for (uid,) in db.query(User.id).filter(User.group_id == group_id)]
    guest = get_guest_user(db)

    if uid_list:
        q_files = db.query(File).filter(File.user_id.in_(uid_list))
        if delete_files:
            delete_physical_files(q_files.all())
            q_files.delete(synchronize_session=False)
        else:
            q_files.update({"user_id": guest.id}, synchronize_session=False)

        db.query(UserSession).filter(UserSession.user_id.in_(uid_list)).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_(uid_list)).delete(
            synchronize_session=False
        )

    db.delete(grp)
    db.commit()
    return {
        "detail": f"Group '{grp.name}' deleted.",
        "files_deleted": bool(delete_files),
        "files_reassigned": not delete_files,
    }

# ────────────────────────────────────────────────────────────────────
#  Users API
# ────────────────────────────────────────────────────────────────────
@router.get("/users", response_model=List[UserRead])
def list_users(
    group_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    q = db.query(User)
    if group_id is not None:
        q = q.filter(User.group_id == group_id)
    users = q.all()

    out: list[UserRead] = []
    for u in users:
        cnt, bytes_ = (
            db.query(
                func.count(File.id),
                func.coalesce(func.sum(File.size), 0),
            )
            .filter(File.user_id == u.id)
            .first()
        )
        out.append(
            UserRead(
                id=u.id,
                username=u.username,
                email=u.email,
                group={"id": u.group.id, "name": u.group.name} if u.group else None,
                file_count=cnt,
                storage_bytes=bytes_,
            )
        )
    return out


@router.put("/users/{user_id}/group", response_model=UserRead)
def update_user_group(
    user_id: int,
    payload: UserGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    usr = db.query(User).filter(User.id == user_id).first()
    if not usr:
        raise HTTPException(status_code=404, detail="User not found.")
    if usr.group and usr.group.name in IMMUTABLE_GROUPS:
        raise HTTPException(
            status_code=400, detail=f"Cannot modify {usr.group.name} user."
        )

    new_grp = db.query(Group).filter(Group.id == payload.group_id).first()
    if not new_grp:
        raise HTTPException(status_code=400, detail="Group not found.")
    if new_grp.name in IMMUTABLE_GROUPS:
        raise HTTPException(
            status_code=400, detail=f"Cannot assign users to {new_grp.name}."
        )

    usr.group_id = new_grp.id
    db.add(usr)
    db.commit()
    db.refresh(usr)

    cnt, bytes_ = db.query(
        func.count(File.id),
        func.coalesce(func.sum(File.size), 0),
    ).filter(File.user_id == usr.id).first()

    return UserRead(
        id=usr.id,
        username=usr.username,
        email=usr.email,
        group={"id": new_grp.id, "name": new_grp.name},
        file_count=cnt,
        storage_bytes=bytes_,
    )


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    delete_files: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    usr = db.query(User).filter(User.id == user_id).first()
    if not usr:
        raise HTTPException(status_code=404, detail="User not found.")
    if usr.group and usr.group.name in IMMUTABLE_GROUPS:
        raise HTTPException(
            status_code=400, detail=f"Cannot delete {usr.group.name} user."
        )

    # sessions
    db.query(UserSession).filter(UserSession.user_id == usr.id).delete(
        synchronize_session=False
    )

    # files
    q_files = db.query(File).filter(File.user_id == usr.id)
    if delete_files:
        delete_physical_files(q_files.all())
        q_files.delete(synchronize_session=False)
    else:
        guest = get_guest_user(db)
        q_files.update({"user_id": guest.id}, synchronize_session=False)

    db.delete(usr)
    db.commit()
    return {
        "detail": f"User {usr.username} deleted.",
        "files_deleted": bool(delete_files),
        "files_reassigned": not delete_files,
    }

# ────────────────────────────────────────────────────────────────────
#  File lists (admin)
# ────────────────────────────────────────────────────────────────────
@router.get("/groups/{group_id}/files", response_model=List[MyFileItem])
def list_group_files(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    rows = (
        db.query(File)
        .join(User, User.id == File.user_id)
        .filter(User.group_id == group_id)
        .order_by(File.id.desc())
        .all()
    )
    return [
        MyFileItem(
            file_id=f.id,
            original_filename=f.original_filename,
            direct_link=f"/uploads/{f.storage_data.get('path')}",
        )
        for f in rows
    ]


@router.get("/users/{user_id}/files", response_model=List[MyFileItem])
def list_user_files(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)

    rows = (
        db.query(File)
        .filter(File.user_id == user_id)
        .order_by(File.id.desc())
        .all()
    )
    return [
        MyFileItem(
            file_id=f.id,
            original_filename=f.original_filename,
            direct_link=f"/uploads/{f.storage_data.get('path')}",
        )
        for f in rows
    ]

# ────────────────────────────────────────────────────────────────────
#  System settings
# ────────────────────────────────────────────────────────────────────
@router.get("/system-settings", response_model=SystemSettingsRead)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_superadmin(current_user)
    s = db.query(SystemSettings).first()
    if not s:
        return SystemSettingsRead(
            registration_enabled=True,
            public_upload_enabled=False,
            default_user_group_id=None,
        )
    return SystemSettingsRead(
        registration_enabled=s.registration_enabled,
        public_upload_enabled=s.public_upload_enabled,
        default_user_group_id=s.default_user_group_id,
    )


@router.put("/system-settings", response_model=SystemSettingsRead)
def update_system_settings(
    payload: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    db.add(s)
    db.commit()
    db.refresh(s)

    return SystemSettingsRead(
        registration_enabled=s.registration_enabled,
        public_upload_enabled=s.public_upload_enabled,
        default_user_group_id=s.default_user_group_id,
    )
