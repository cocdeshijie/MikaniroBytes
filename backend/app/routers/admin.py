from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.db.database import get_db
from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.group_settings import GroupSettings
from app.db.models.file import File

router = APIRouter()


def ensure_superadmin(user: User):
    """Helper: only SUPER_ADMIN can access these endpoints."""
    if not user.group or user.group.name != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can perform this action.")


class GroupCreate(BaseModel):
    name: str
    allowed_extensions: list[str] = ["jpg", "png", "gif"]
    max_file_size: int = 10_000_000
    max_storage_size: Optional[int] = None  # None => unlimited


class GroupRead(BaseModel):
    id: int
    name: str
    allowed_extensions: list[str]
    max_file_size: int
    max_storage_size: Optional[int]

    class Config:
        orm_mode = True


class GroupUpdate(BaseModel):
    # In future, you might make fields optional to allow partial update
    name: Optional[str] = None
    allowed_extensions: Optional[List[str]] = None
    max_file_size: Optional[int] = None
    max_storage_size: Optional[int] = None


@router.get("/groups", response_model=List[GroupRead])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all groups with their settings.
    Must be SUPER_ADMIN.
    """
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
            # If group has no settings row, default them
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
    """
    Create a new group with the specified name and settings.
    Must be SUPER_ADMIN.
    """
    ensure_superadmin(current_user)

    # Check if group name is already in use
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
    """
    Update a group's name or settings.
    Must be SUPER_ADMIN.
    """
    ensure_superadmin(current_user)

    db_group = db.query(Group).filter(Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found.")

    if db_group.name == "SUPER_ADMIN":
        # In theory you might allow updates to SUPER_ADMIN settings, but be cautious
        # For safety, let's forbid changing name:
        if payload.name and payload.name != "SUPER_ADMIN":
            raise HTTPException(status_code=400, detail="Cannot rename SUPER_ADMIN group.")
        # but let's allow updating settings if you want:
        pass

    # Update group name if provided
    if payload.name and db_group.name != "SUPER_ADMIN":
        # check uniqueness
        existing = db.query(Group).filter(Group.name == payload.name).first()
        if existing and existing.id != group_id:
            raise HTTPException(status_code=400, detail="Another group with that name exists.")
        db_group.name = payload.name

    # Update settings
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
    delete_files: bool = Query(False, description="Whether to also delete users' files"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an entire group.
    - All users in that group will be deleted.
    - If delete_files=True, also remove all their files from DB (and optionally from disk if local).
    Must be SUPER_ADMIN.

    SUPER_ADMIN group cannot be deleted.
    """
    ensure_superadmin(current_user)

    db_group = db.query(Group).filter(Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found.")

    if db_group.name == "SUPER_ADMIN":
        raise HTTPException(status_code=400, detail="Cannot delete the SUPER_ADMIN group.")

    # Collect user IDs for that group
    users_in_group = db.query(User).filter(User.group_id == group_id).all()
    user_ids = [u.id for u in users_in_group]

    if delete_files and user_ids:
        # Delete all files belonging to these users
        # If you also want to remove them from disk, you'd open the path from storage_data & remove.
        db.query(File).filter(File.user_id.in_(user_ids)).delete(synchronize_session=False)

    # Deleting the group cascades the group_settings via "ondelete=CASCADE"
    # But you also want to delete the users.
    # "ondelete=SET NULL" was used for user->group in your model, so it won't remove the users automatically.
    # So we'll explicitly remove them:
    db.query(User).filter(User.group_id == group_id).delete(synchronize_session=False)

    # Finally remove the group row
    db.delete(db_group)
    db.commit()

    return {"detail": f"Group '{db_group.name}' deleted. Users removed. Files_deleted={delete_files}"}
