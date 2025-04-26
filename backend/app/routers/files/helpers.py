import os
import hashlib
import time
import secrets
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models.file import File as FileModel
from app.db.models.storage_enums import FileType, StorageType
from app.db.models.group_settings import GroupSettings
from app.db.models.system_settings import SystemSettings


UPLOAD_DIR = "uploads"


# ─────────────────────────────────────────────────────────────────────
#  Custom exceptions for file validation
# ─────────────────────────────────────────────────────────────────────
class ExceedsSizeLimitError(Exception):
    """Raised when the file's size exceeds max_file_size."""
    pass


class ExtensionNotAllowedError(Exception):
    """Raised when the file's extension is not in allowed_extensions."""
    pass


# ─────────────────────────────────────────────────────────────────────
#  Validate single-file constraints (extension + size)
# ─────────────────────────────────────────────────────────────────────
def validate_upload(file_data: bytes, filename: str, group_settings: GroupSettings):
    """
    • If group_settings.max_file_size is not None,
      raise ExceedsSizeLimitError if file is bigger.
    • If group_settings.allowed_extensions is non-empty,
      enforce extension membership (case-insensitive).
    """
    if not group_settings:
        return  # no constraints if settings is missing

    # 1) Enforce max_file_size
    if group_settings.max_file_size is not None:
        if len(file_data) > group_settings.max_file_size:
            raise ExceedsSizeLimitError(
                f"File size {len(file_data)} bytes exceeds limit "
                f"{group_settings.max_file_size}."
            )

    # 2) Enforce allowed_extensions
    exts = group_settings.allowed_extensions or []
    if exts:  # not empty ⇒ must match
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        allowed_lower = [x.lower() for x in exts]
        if ext not in allowed_lower:
            raise ExtensionNotAllowedError(
                f"File extension '.{ext}' is not allowed. "
                f"Allowed list: {', '.join(exts)}"
            )


# ─────────────────────────────────────────────────────────────────────
#  Very naive extension-based detection
# ─────────────────────────────────────────────────────────────────────
def guess_file_type_by_extension(filename: str) -> FileType:
    """
    Very naive extension-based detection.
    e.g. ".jpg" → FileType.IMAGE
    Otherwise FileType.BASE
    """
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext in ["jpg", "jpeg", "png", "gif", "bmp", "webp"]:
        return FileType.IMAGE
    return FileType.BASE


# ─────────────────────────────────────────────────────────────────────
#  Render {Y}/{m}/{d}, etc.
# ─────────────────────────────────────────────────────────────────────
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
            .strip("/\\")
        )
    except Exception:
        return ""


# ─────────────────────────────────────────────────────────────────────
#  store_new_file
# ─────────────────────────────────────────────────────────────────────
def store_new_file(
    db: Session,
    file_contents: bytes,
    original_filename: str,
    owner_id: Optional[int],
    settings: Optional[SystemSettings] = None,
) -> FileModel:
    """
    1) Picks a sub-directory from *settings* (upload_path_template).
    2) Saves the file to disk in /uploads/<subdir>.
    3) Creates a DB row.
    4) Returns the new FileModel.
    """
    if not file_contents:
        raise ValueError("Empty file")

    # Choose sub-directory from template
    template = (
        settings.upload_path_template
        if (settings and settings.upload_path_template)
        else "{Y}/{m}"
    )
    rel_dir = render_path_template(template, datetime.utcnow())
    target_dir = os.path.join(UPLOAD_DIR, rel_dir)
    os.makedirs(target_dir, exist_ok=True)

    # Build hashed file name
    uniq = (
        f"{original_filename}-{len(file_contents)}-"
        f"{time.time()}-{secrets.token_hex(8)}"
    )
    hashed = hashlib.sha256(uniq.encode()).hexdigest()[:16]
    _, ext = os.path.splitext(original_filename)
    hashed_name = hashed + ext.lower()

    rel_file_path = os.path.join(rel_dir, hashed_name) if rel_dir else hashed_name
    abs_file_path = os.path.join(target_dir, hashed_name)

    # Write to disk
    with open(abs_file_path, "wb") as out:
        out.write(file_contents)

    # Create DB row
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

    return db_file


# ─────────────────────────────────────────────────────────────────────
#  store_file_from_archive
# ─────────────────────────────────────────────────────────────────────
def store_file_from_archive(
    db: Session,
    file_contents: bytes,
    archive_path: str,
    owner_id: Optional[int],
) -> FileModel:
    """
    Bulk-upload helper that **preserves** the path found inside the
    ZIP/TAR file, e.g. "assets/img/logo.png" → uploads/assets/img/logo.png.

    **Duplicate-file guard**
    • If a file with the same relative path already exists on disk **or**
      is already registered in the DB, raise `FileExistsError` so the
      caller can treat it as a failed import instead of silently
      overwriting data.
    """
    if not file_contents:
        raise ValueError("Empty file")

    # Make sure archive_path doesn't start with / or .. (security)
    safe_path = _sanitize_archive_path(archive_path)
    if not safe_path:
        raise ValueError(f"Invalid archive path: {archive_path}")

    final_abs_path = os.path.join(UPLOAD_DIR, safe_path)

    # ── 1) Filesystem duplicate
    if os.path.exists(final_abs_path):
        raise FileExistsError(f"File already exists on disk: {safe_path}")

    # ── 2) Database duplicate
    existing_row = (
        db.query(FileModel)
        .filter(FileModel.storage_data["path"].as_string() == safe_path)
        .first()
    )
    if existing_row:
        raise FileExistsError(f"File already registered in DB: {safe_path}")

    # Write the new file
    final_dir = os.path.dirname(final_abs_path)
    os.makedirs(final_dir, exist_ok=True)
    with open(final_abs_path, "wb") as out:
        out.write(file_contents)

    # Store DB row
    db_file = FileModel(
        size=len(file_contents),
        file_type=FileType.BASE,
        storage_type=StorageType.LOCAL,
        storage_data={"path": safe_path},
        content_type="application/octet-stream",
        user_id=owner_id,
        original_filename=os.path.basename(archive_path),
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return db_file


# ─────────────────────────────────────────────────────────────────────
#  sanitize path
# ─────────────────────────────────────────────────────────────────────
def _sanitize_archive_path(path_in_archive: str) -> str:
    """
    Remove any leading slashes or '..' segments so we never break out
    of the uploads directory.

    Examples
    --------
    "assets/img/logo.png" → "assets/img/logo.png"
    "/etc/passwd"         → "etc/passwd"
    "../secret.txt"       → "secret.txt"
    """
    # Remove leading slashes/backslashes
    p = path_in_archive.lstrip("/\\")
    # Normalise Windows paths in archives
    p = p.replace("\\", "/")

    # Remove '.' or '..' components
    parts = []
    for seg in p.split("/"):
        if seg in (".", "..", ""):
            continue
        parts.append(seg)
    return "/".join(parts)
