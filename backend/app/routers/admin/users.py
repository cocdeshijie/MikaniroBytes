from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.file import File
from app.db.models.user_session import UserSession
from app.dependencies.auth import get_current_user
from .helpers import (
    IMMUTABLE_GROUPS,
    ensure_superadmin,
    delete_physical_files,
    get_guest_user
)


router = APIRouter()


# Pydantic models
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


@router.get("/users", response_model=List[UserRead])
def list_users(
    group_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List users, optionally filtered by group_id.
    Only SUPER_ADMIN can access.
    """
    ensure_superadmin(current_user)

    q = db.query(User)
    if group_id is not None:
        q = q.filter(User.group_id == group_id)
    users = q.all()

    out = []
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
    """
    Assign a user to a new group. (Must not be GUEST or SUPER_ADMIN user.)
    """
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
    """
    Delete a user.
    - If delete_files=true => remove all their files from disk & DB
    - else => reassign them to guest
    - Must not delete GUEST or SUPER_ADMIN user
    """
    ensure_superadmin(current_user)

    usr = db.query(User).filter(User.id == user_id).first()
    if not usr:
        raise HTTPException(status_code=404, detail="User not found.")
    if usr.group and usr.group.name in IMMUTABLE_GROUPS:
        raise HTTPException(
            status_code=400, detail=f"Cannot delete {usr.group.name} user."
        )

    # Delete sessions
    db.query(UserSession).filter(UserSession.user_id == usr.id).delete(
        synchronize_session=False
    )

    # Files
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


@router.get("/users/{user_id}/files", response_model=List[dict])
def list_user_files(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all files owned by a specific user. SUPER_ADMIN only.
    """
    ensure_superadmin(current_user)

    rows = (
        db.query(File)
        .filter(File.user_id == user_id)
        .order_by(File.id.desc())
        .all()
    )
    return [
        {
            "file_id": f.id,
            "original_filename": f.original_filename,
            "direct_link": f"/uploads/{f.storage_data.get('path')}",
        }
        for f in rows
    ]
