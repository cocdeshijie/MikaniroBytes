import hashlib
import os
import secrets
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models.file import File as FileModel
from app.db.models.storage_enums import FileType, StorageType
from app.db.models.user import User
from app.db.models.system_settings import SystemSettings


UPLOAD_DIR = "uploads"


def render_path_template(template: str, now: datetime) -> str:
    """
    Render {Y}, {m}, {d}, {H}, {M}, {S} tokens in *template* using *now*.
    """
    try:
        return (
            template.replace("{Y}", now.strftime("%Y"))
            .replace("{m}", now.strftime("%m"))
            .replace("{d}", now.strftime("%d"))
            .replace("{H}", now.strftime("%H"))
            .replace("{M}", now.strftime("%M"))
            .replace("{S}", now.strftime("%S"))
            .strip("/")
            .strip("\\")
        )
    except Exception:
        return ""


def store_new_file(
    db: Session,
    file_contents: bytes,
    original_filename: str,
    owner_id: Optional[int],
    settings: Optional[SystemSettings] = None,
) -> FileModel:
    """
    Core helper that:
      1) Determines a hashed name + subdirectory from *settings*.
      2) Saves *file_contents* on disk under /uploads/<subdir>.
      3) Creates a DB row in files table.
      4) Returns the new FileModel.

    If *owner_id* is None, the file has no assigned user (or guest user).
    """
    if not file_contents:
        raise ValueError("Empty file")

    # Choose sub-directory from template
    # If no system_settings or no template, default to {Y}/{m}
    template = settings.upload_path_template if (settings and settings.upload_path_template) else "{Y}/{m}"
    rel_dir = render_path_template(template, datetime.utcnow())
    target_dir = os.path.join(UPLOAD_DIR, rel_dir)
    os.makedirs(target_dir, exist_ok=True)

    # Build hashed file name
    uniq = f"{original_filename}-{len(file_contents)}-{time.time()}-{secrets.token_hex(8)}"
    hashed = hashlib.sha256(uniq.encode()).hexdigest()[:16]
    # get extension
    _, ext = os.path.splitext(original_filename)
    hashed_name = hashed + ext.lower()

    rel_file_path = os.path.join(rel_dir, hashed_name) if rel_dir else hashed_name
    abs_file_path = os.path.join(target_dir, hashed_name)

    # Write the file to disk
    with open(abs_file_path, "wb") as out:
        out.write(file_contents)

    # Create a DB row
    db_file = FileModel(
        size=len(file_contents),
        file_type=FileType.BASE,
        storage_type=StorageType.LOCAL,
        storage_data={"path": rel_file_path},
        content_type="application/octet-stream",
        user_id=owner_id,
        original_filename=original_filename,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    # If you want background tasks or post-processing, you can trigger them here:
    # e.g. queue_video_encoding(db_file), or something similar.

    return db_file


def store_file_from_archive(
    db: Session,
    file_contents: bytes,
    archive_path: str,
    owner_id: Optional[int],
) -> FileModel:
    """
    Bulk-specific function that preserves the ZIP/TAR subpath.
    E.g. if 'archive_path' = 'assets/img/logo.png',
    it creates 'uploads/assets/img/logo.png'.

    We'll do minimal collision logic (by default overwrite).
    If you want collisions to be handled differently, you can
    rename or skip, etc. as you see fit.
    """
    if not file_contents:
        raise ValueError("Empty file")

    # Make sure archive_path doesn't start with / or ..
    # for security reasons
    safe_path = _sanitize_archive_path(archive_path)
    if not safe_path:
        raise ValueError(f"Invalid archive path: {archive_path}")

    final_abs_path = os.path.join(UPLOAD_DIR, safe_path)
    final_dir = os.path.dirname(final_abs_path)
    os.makedirs(final_dir, exist_ok=True)

    # Overwrite if file already exists
    with open(final_abs_path, "wb") as out:
        out.write(file_contents)

    # Store a DB row
    db_file = FileModel(
        size=len(file_contents),
        file_type=FileType.BASE,
        storage_type=StorageType.LOCAL,
        storage_data={"path": safe_path},  # e.g. "assets/img/logo.png"
        content_type="application/octet-stream",
        user_id=owner_id,
        original_filename=os.path.basename(archive_path),
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return db_file


def _sanitize_archive_path(path_in_archive: str) -> str:
    """
    Remove any leading slashes or '..' segments,
    so we don't break out of the 'uploads' folder.

    e.g.
      "assets/img/logo.png" -> "assets/img/logo.png"
      "/etc/passwd" -> "etc/passwd"
      "../secret.txt" -> "secret.txt"
    """
    # Remove any leading slashes/backslashes:
    p = path_in_archive.lstrip("/\\")
    # Replace backslashes with forward slashes (if on Windows or if the archive had them)
    p = p.replace("\\", "/")

    # Split path segments and remove '.' or '..'
    parts = []
    for seg in p.split("/"):
        if seg in (".", "..", ""):
            continue
        parts.append(seg)
    # Reassemble
    sanitized = "/".join(parts)
    return sanitized
