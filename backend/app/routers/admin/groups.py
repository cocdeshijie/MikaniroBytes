from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.group_settings import GroupSettings
from app.db.models.system_settings import SystemSettings
from app.db.models.file import File
from app.dependencies.auth import get_current_user
from app.routers.files.management import MyFileItem
from .helpers import (
    IMMUTABLE_GROUPS,
    ensure_superadmin,
    delete_physical_files
)


router = APIRouter()


# ─────────────────────────────────────────────────────────────────────
#  Pydantic models
# ─────────────────────────────────────────────────────────────────────
class GroupCreate(BaseModel):
    name: str
    allowed_extensions: List[str] | None = None
    max_file_size: int | None = None
    max_storage_size: int | None = None


class GroupRead(BaseModel):
    id: int
    name: str
    allowed_extensions: List[str]
    max_file_size: int | None
    max_storage_size: int | None
    file_count: int
    storage_bytes: int

    class Config:
        from_attributes = True


class GroupUpdate(BaseModel):
    name: str | None = None
    allowed_extensions: List[str] | None = None
    max_file_size: int | None = None
    max_storage_size: int | None = None


# ─────────────────────────────────────────────────────────────────────
#  List groups
# ─────────────────────────────────────────────────────────────────────
@router.get("/groups", response_model=List[GroupRead])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a list of all groups with aggregated file counts.
    Only SUPER_ADMIN can access this endpoint.
    """
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

    out = []
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


# ─────────────────────────────────────────────────────────────────────
#  Create group
# ─────────────────────────────────────────────────────────────────────
@router.post("/groups", response_model=GroupRead)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new group.
    Reserved group names: SUPER_ADMIN, GUEST

    If max_file_size / max_storage_size is None => unlimited.
    If allowed_extensions is None or empty => no restriction on extensions.
    """
    ensure_superadmin(current_user)

    if payload.name in IMMUTABLE_GROUPS:
        raise HTTPException(status_code=400, detail="Reserved group name.")
    if db.query(Group).filter(Group.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Group already exists.")

    grp = Group(name=payload.name)

    # If user left allowed_extensions blank => default to []
    exts = payload.allowed_extensions or []

    grp.settings = GroupSettings(
        allowed_extensions=exts,
        max_file_size=payload.max_file_size,       # None => unlimited
        max_storage_size=payload.max_storage_size, # None => unlimited
    )
    db.add(grp)
    db.commit()
    db.refresh(grp)

    # Recompute aggregated file info
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
        allowed_extensions=grp.settings.allowed_extensions,
        max_file_size=grp.settings.max_file_size,
        max_storage_size=grp.settings.max_storage_size,
        file_count=cnt,
        storage_bytes=bytes_,
    )


# ─────────────────────────────────────────────────────────────────────
#  Update group
# ─────────────────────────────────────────────────────────────────────
@router.put("/groups/{group_id}", response_model=GroupRead)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update group name or settings.
    Built-in groups (SUPER_ADMIN, GUEST) cannot be renamed or deleted.

    • If user passes null => store None (unlimited).
    • If user omits the field => keep existing.
    • If user provides a new non-null value => update it.
    """
    ensure_superadmin(current_user)

    grp = db.query(Group).filter(Group.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found.")

    # Renaming logic
    if payload.name is not None and payload.name != grp.name:
        if grp.name in IMMUTABLE_GROUPS:
            raise HTTPException(status_code=400, detail="Cannot rename built‑in group.")
        if payload.name in IMMUTABLE_GROUPS:
            raise HTTPException(status_code=400, detail="Reserved group name.")
        dup = db.query(Group).filter(Group.name == payload.name).first()
        if dup and dup.id != group_id:
            raise HTTPException(status_code=400, detail="Name is already in use.")
        grp.name = payload.name

    # Update settings
    sett = grp.settings or GroupSettings(group_id=grp.id)

    # We check each field's presence
    p_dict = payload.dict(exclude_unset=True)

    if "allowed_extensions" in p_dict:
        sett.allowed_extensions = payload.allowed_extensions or []

    if "max_file_size" in p_dict:
        # If user passed null => None (unlimited)
        sett.max_file_size = payload.max_file_size

    if "max_storage_size" in p_dict:
        sett.max_storage_size = payload.max_storage_size

    db.add_all([grp, sett])
    db.commit()
    db.refresh(grp)

    # Recompute file_count, storage_bytes
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


# ─────────────────────────────────────────────────────────────────────
#  Delete group
# ─────────────────────────────────────────────────────────────────────
@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    delete_files: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a group.
    - SUPER_ADMIN, GUEST are protected.
    - `delete_files=true` => remove physical files + DB rows.
    - else => reassign files to the 'guest' user.
    """
    from .helpers import get_guest_user

    ensure_superadmin(current_user)

    grp = db.query(Group).filter(Group.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found.")
    if grp.name in IMMUTABLE_GROUPS:
        raise HTTPException(status_code=400, detail=f"Cannot delete {grp.name}.")

    # Must leave at least one normal group
    remaining = (
        db.query(Group)
        .filter(Group.id != group_id, ~Group.name.in_(IMMUTABLE_GROUPS))
        .count()
    )
    if remaining == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one non‑admin group must remain.",
        )

    # Fix default group if needed
    settings = db.query(SystemSettings).first()
    if settings and settings.default_user_group_id == group_id:
        fallback = (
            db.query(Group)
            .filter(Group.id != group_id, ~Group.name.in_(IMMUTABLE_GROUPS))
            .order_by(Group.id.desc())
            .first()
        )
        settings.default_user_group_id = fallback.id if fallback else None
        db.add(settings)

    # Collect user IDs
    uid_list = [uid for (uid,) in db.query(User.id).filter(User.group_id == group_id)]

    if uid_list:
        q_files = db.query(File).filter(File.user_id.in_(uid_list))
        if delete_files:
            delete_physical_files(q_files.all())
            q_files.delete(synchronize_session=False)
        else:
            guest = get_guest_user(db)
            q_files.update({"user_id": guest.id}, synchronize_session=False)

        db.query(User).filter(User.id.in_(uid_list)).delete(synchronize_session=False)

    db.delete(grp)
    db.commit()
    return {
        "detail": f"Group '{grp.name}' deleted.",
        "files_deleted": bool(delete_files),
        "files_reassigned": not delete_files,
    }


# ─────────────────────────────────────────────────────────────────────
# Return all files owned by members of a given group, with preview info
# ─────────────────────────────────────────────────────────────────────
@router.get("/groups/{group_id}/files", response_model=List[MyFileItem])
def list_group_files(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all files owned by members of a given group.
    SUPER_ADMIN only. Includes preview data.
    """
    ensure_superadmin(current_user)

    rows = (
        db.query(File)
        .join(User, User.id == File.user_id)
        .filter(User.group_id == group_id)
        .order_by(File.id.desc())
        .all()
    )

    out = []
    for f in rows:
        has_preview = bool(f.has_preview and f.default_preview_path)
        preview_url = None
        if has_preview:
            preview_url = f"/previews/{f.default_preview_path}"
        out.append(
            MyFileItem(
                file_id=f.id,
                original_filename=f.original_filename,
                direct_link=f"/{f.storage_data.get('path')}",
                has_preview=has_preview,
                preview_url=preview_url,
            )
        )
    return out

