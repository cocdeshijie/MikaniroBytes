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
    Delete the main files + all preview images from disk,
    plus remove now-empty directories if any.
    Returns the number of main files processed.
    """
    from app.routers.files.management import disk_path, _cleanup_empty_dirs

    count = 0
    for f in file_rows:
        # 1) Delete all preview images (but do NOT remove parent folders)
        for preview in f.previews:
            preview_abs = os.path.join("previews", preview.storage_path)
            if preview_abs and os.path.isfile(preview_abs):
                try:
                    os.remove(preview_abs)
                    # Not calling _cleanup_empty_dirs(preview_abs) here,
                    # so we don't remove entire /previews folder.
                except OSError:
                    pass

        # 2) Delete the main file (and optionally remove empty dirs under /uploads)
        rel = f.storage_data.get("path", "")
        abs_path = disk_path(rel)  # this is your /uploads path
        if abs_path and os.path.isfile(abs_path):
            try:
                os.remove(abs_path)
                _cleanup_empty_dirs(abs_path)  # we still remove empty folders from /uploads if you want
            except OSError:
                pass
        count += 1

    return count
