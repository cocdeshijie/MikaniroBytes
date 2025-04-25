import os
from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.file import File
from app.db.models.system_settings import SystemSettings


# Constants / shared helpers
IMMUTABLE_GROUPS: set[str] = {"SUPER_ADMIN", "GUEST"}


def ensure_superadmin(user: User) -> None:
    """
    Helper that raises 403 if *user* is not in SUPER_ADMIN group.
    """
    if not user.group or user.group.name != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN allowed")


def get_guest_user(db: Session) -> User:
    """
    Return the special 'guest' user from the 'GUEST' group.
    Raises HTTP 500 if missing.
    """
    guest = (
        db.query(User)
        .join(Group, Group.id == User.group_id)
        .filter(Group.name == "GUEST", User.username == "guest")
        .first()
    )
    if not guest:
        raise HTTPException(
            status_code=500,
            detail="Guest user missing – did you run init_db() on start-up?",
        )
    return guest


def delete_physical_files(file_rows: List[File]) -> int:
    """
    Delete the files on disk referenced by *file_rows*,
    and remove now-empty directories up to the uploads/ root.
    Returns the number of file paths attempted.
    """
    from app.routers.files.management import disk_path, _cleanup_empty_dirs  # local import to avoid cyclic import

    count = 0
    for f in file_rows:
        rel = f.storage_data.get("path", "")
        abs_path = disk_path(rel)
        if abs_path and os.path.isfile(abs_path):
            try:
                os.remove(abs_path)
                _cleanup_empty_dirs(abs_path)
            except OSError:
                pass
        count += 1
    return count
