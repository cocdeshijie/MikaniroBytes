import hashlib
import io
import os
import secrets
import shutil
import tarfile
import tempfile
import time
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import List, Optional

import mimetypes
from fastapi import (
    APIRouter,
    Depends,
    File as FastFile,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.file import File as FileModel
from app.db.models.storage_enums import FileType, StorageType
from app.db.models.user import User
from app.db.models.system_settings import SystemSettings
from app.dependencies.auth import get_current_user, get_optional_user

# -----------------------------------------------------------------------------
# Router & constants
# -----------------------------------------------------------------------------
router = APIRouter()
UPLOAD_DIR = "uploads"  # absolute or relative base folder on disk


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def is_super_admin(user: User) -> bool:
    """Return True if the user belongs to the SUPER_ADMIN group."""
    return getattr(user.group, "name", "").upper() == "SUPER_ADMIN"


def disk_path(rel_path: str) -> str:
    """Convert a relative DB path into an absolute path on disk."""
    return os.path.join(UPLOAD_DIR, rel_path)


def render_path_template(template: str, now: datetime) -> str:
    """
    Render {Y}, {m}, {d}, {H}, {M}, {S} tokens in *template* using *now*.
    Falls back to empty string on any problems.
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


def _safe_member_path(base: Path, member: str) -> Path:
    """
    Prevent path-traversal when extracting archives.

    Returns an *absolute* destination inside *base*.
    """
    # Convert to posix, drop leading “/”
    rel = PurePosixPath(member).as_posix().lstrip("/")

    dest = (base / rel).resolve()
    if not str(dest).startswith(str(base.resolve())):
        raise ValueError("Illegal member path")

    dest.parent.mkdir(parents=True, exist_ok=True)
    return dest


def _cleanup_empty_dirs(start: str) -> None:
    """
    Given *start* as an **absolute** file path that has just been deleted,
    remove any empty parent directories until we reach UPLOAD_DIR.
    """
    root = os.path.abspath(UPLOAD_DIR)
    parent = os.path.dirname(start)

    while os.path.abspath(parent).startswith(root) and os.path.abspath(parent) != root:
        try:
            if not os.listdir(parent):
                os.rmdir(parent)
                parent = os.path.dirname(parent)          # climb one level up
            else:
                break                                      # parent not empty → stop
        except OSError:
            break


# -----------------------------------------------------------------------------
# Pydantic DTOs
# -----------------------------------------------------------------------------
class MyFileItem(BaseModel):
    file_id: int
    original_filename: Optional[str]
    direct_link: str

    class Config:
        orm_mode = True


class BatchDeletePayload(BaseModel):
    ids: List[int]


class BatchDownloadPayload(BaseModel):
    ids: List[int]


class BulkUploadSummary(BaseModel):
    success: int
    failed: int
    result_text: str


# =============================================================================
# 0)  Bulk upload
# =============================================================================
@router.post("/bulk-upload", response_model=BulkUploadSummary)
async def bulk_upload(
    archive: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a .zip / .tar / .tar.gz archive and import **all** files inside.

    * The **original folder structure and file names are preserved** under
      the server-side *uploads/* directory – no user prefix is added.
    * Every imported file row is bound to the uploading user (`user_id`).
    * A plain-text summary is returned **in the JSON payload**; nothing is
      written to disk except the uploaded files themselves.
    """
    # ------------- basic validation --------------------------------
    if not archive.filename:
        raise HTTPException(400, "Archive must have a filename.")

    name_lower = archive.filename.lower()
    is_zip = name_lower.endswith(".zip")
    is_tar = name_lower.endswith((".tar", ".tar.gz", ".tgz"))
    if not (is_zip or is_tar):
        raise HTTPException(400, "Only .zip or .tar(.gz) archives are accepted.")

    data = await archive.read()
    if not data:
        raise HTTPException(400, "Uploaded archive is empty.")

    buffer = io.BytesIO(data)

    # ------------- helper to import one file -----------------------
    summary_lines: list[str] = []
    ok_count = 0
    fail_count = 0

    def _import_file(member_name: str, _reader: io.BufferedReader):
        nonlocal ok_count, fail_count
        # normalise path & block traversal
        safe_name = Path(member_name).as_posix().lstrip("/").replace("..", "")
        if not safe_name or safe_name.endswith("/"):
            return  # skip directories / empty entries

        target_abs = Path(UPLOAD_DIR) / safe_name
        try:
            target_abs.parent.mkdir(parents=True, exist_ok=True)
        except OSError:
            fail_count += 1
            summary_lines.append(f"{safe_name}\t<cannot create directory>")
            return

        if target_abs.exists():
            fail_count += 1
            summary_lines.append(f"{safe_name}\t<already exists>")
            return

        try:
            with open(target_abs, "wb") as f_out:
                f_out.write(_reader.read())
        except Exception as exc:
            fail_count += 1
            summary_lines.append(f"{safe_name}\t{exc}")
            return

        # --- DB row ---
        db.add(
            FileModel(
                size=target_abs.stat().st_size,
                file_type=FileType.BASE,
                storage_type=StorageType.LOCAL,
                storage_data={"path": safe_name},
                content_type=mimetypes.guess_type(safe_name)[0] or "application/octet-stream",
                user_id=current_user.id,
                original_filename=Path(safe_name).name,
            )
        )
        ok_count += 1

    # ------------- iterate archive ---------------------------------
    try:
        if is_zip:
            with zipfile.ZipFile(buffer) as zf:
                for member in zf.infolist():
                    if member.is_dir():
                        continue
                    with zf.open(member) as r:
                        _import_file(member.filename, r)
        else:  # tar / tar.gz
            buffer.seek(0)
            mode = "r:gz" if name_lower.endswith((".tar.gz", ".tgz")) else "r:"
            with tarfile.open(fileobj=buffer, mode=mode) as tf:
                for member in tf.getmembers():
                    if member.isdir() or member.islnk() or member.issym():
                        continue
                    r = tf.extractfile(member)
                    if r:
                        _import_file(member.name, r)
    except Exception as exc:
        raise HTTPException(400, f"Archive error: {exc}")

    db.commit()

    # ------------- compose report ----------------------------------
    summary_lines.insert(0, f"{ok_count}/{ok_count+fail_count} success")
    if fail_count:
        summary_lines.insert(1, f"{fail_count} failed\n")
    report_text = "\n".join(summary_lines) or "Nothing imported."

    return BulkUploadSummary(
        success=ok_count,
        failed=fail_count,
        result_text=report_text,
    )


@router.get("/bulk-result/{user_id}/{fname}")
def get_bulk_result(user_id: int, fname: str, current_user: User = Depends(get_current_user)):
    """
    Serve result.txt back to its owner.
    SUPER_ADMIN may fetch anyone’s reports.
    """
    if user_id != current_user.id and not is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    path = Path(UPLOAD_DIR) / f"user_{user_id}" / fname
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(path, filename=fname, media_type="text/plain")


# ============================================================================
# 1) Batch DELETE
# ============================================================================
@router.delete("/batch-delete")
def batch_delete_files(
    payload: BatchDeletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete multiple files in one request.

    * Normal users may only delete **their own** uploads.
    * **SUPER_ADMIN** may delete *any* files passed in the `ids` list.
    """
    if not payload.ids:
        raise HTTPException(status_code=400, detail="Empty ids list")

    # build query – scope differs for admins
    query = db.query(FileModel).filter(FileModel.id.in_(payload.ids))
    if not is_super_admin(current_user):
        query = query.filter(FileModel.user_id == current_user.id)

    rows: List[FileModel] = query.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No matching files found")

    deleted_ids: list[int] = []

    for f in rows:
        rel_path: str = f.storage_data.get("path", "")
        abs_path = disk_path(rel_path)

        if os.path.isfile(abs_path):
            try:
                os.remove(abs_path)
                _cleanup_empty_dirs(abs_path)
            except OSError:
                # If the file is already gone we still want to remove the DB row
                pass

        deleted_ids.append(f.id)
        db.delete(f)

    db.commit()
    return {"deleted": deleted_ids}


# ============================================================================
# 2) Batch DOWNLOAD
# ============================================================================
@router.post("/batch-download")
def batch_download_files(
    payload: BatchDownloadPayload,
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = None,
):
    """
    Create an on-the-fly ZIP archive containing the requested files.

    * Normal users may only download **their own** files.
    * **SUPER_ADMIN** can download any listed files.
    * Authentication can be supplied either via an Authorization header or a
      `?token=` query parameter (useful for one-click links).
    """
    # ------------- resolve user (header OR token param) -------------
    current_user: Optional[User] = None
    if token:
        from app.db.models.user_session import UserSession  # local import

        sess = db.query(UserSession).filter(UserSession.token == token).first()
        if sess:
            current_user = db.query(User).filter(User.id == sess.user_id).first()

    if current_user is None:
        current_user = get_current_user(request, db)  # may raise 401

    # ------------- validate ids list -------------------------------
    if not payload.ids:
        raise HTTPException(status_code=400, detail="Empty ids list")

    q = db.query(FileModel).filter(FileModel.id.in_(payload.ids))
    if not is_super_admin(current_user):
        q = q.filter(FileModel.user_id == current_user.id)

    rows: List[FileModel] = q.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No valid files found")

    if not is_super_admin(current_user) and len(rows) != len(payload.ids):
        raise HTTPException(status_code=403, detail="Some files are not yours")

    # ------------- build ZIP in-memory -----------------------------
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        added_names: set[str] = set()
        for f in rows:
            rel_path = f.storage_data.get("path", "")
            abs_path = disk_path(rel_path)
            if not os.path.isfile(abs_path):
                continue  # skip missing files silently

            # ensure unique name inside ZIP
            arcname = f.original_filename or rel_path
            if arcname in added_names:
                base, ext = os.path.splitext(arcname)
                arcname = f"{base}_{f.id}{ext}"
            added_names.add(arcname)

            try:
                zf.write(abs_path, arcname)
            except OSError:
                continue  # skip files that disappear mid-process

    buffer.seek(0)

    filename = f"files_{int(time.time())}.zip"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": "application/zip",
    }
    return StreamingResponse(buffer, headers=headers)


# ============================================================================
# 3) Single UPLOAD
# ============================================================================
@router.post("/upload")
def upload_file(
    request: Request,
    file: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Accept a single file upload and persist it on disk and in the DB."""
    # ---------- public-upload gate ----------------------------------
    settings = db.query(SystemSettings).first()
    if current_user is None:
        if settings and not settings.public_upload_enabled:
            raise HTTPException(
                status_code=403,
                detail="Public uploads are currently disabled.",
            )

    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # ---------------- save on disk ----------------
    uniq = f"{file.filename}-{len(contents)}-{time.time()}-{secrets.token_hex(8)}"
    hashed = hashlib.sha256(uniq.encode()).hexdigest()[:16]
    _, ext = os.path.splitext(file.filename)
    hashed_name = hashed + ext.lower()

    # ---- determine sub-directory from template --------------------
    template = (
        settings.upload_path_template
        if settings and settings.upload_path_template
        else "{Y}/{m}"
    )
    rel_dir = render_path_template(template, datetime.utcnow())  # e.g. "2025/04"
    target_dir = os.path.join(UPLOAD_DIR, rel_dir)
    os.makedirs(target_dir, exist_ok=True)

    rel_file_path = os.path.join(rel_dir, hashed_name) if rel_dir else hashed_name
    abs_file_path = os.path.join(target_dir, hashed_name)

    with open(abs_file_path, "wb") as out:
        out.write(contents)

    # ---------------- owner -----------------------
    owner_id: Optional[int]
    if current_user:
        owner_id = current_user.id
    else:
        guest = db.query(User).filter(User.username == "guest").first()
        owner_id = guest.id if guest else None

    # ---------------- DB row ----------------------
    db_file = FileModel(
        size=len(contents),
        file_type=FileType.BASE,
        storage_type=StorageType.LOCAL,
        storage_data={"path": rel_file_path},
        content_type=file.content_type or "application/octet-stream",
        user_id=owner_id,
        original_filename=file.filename,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    base_url = f"{request.url.scheme}://{request.url.netloc}"
    return {
        "detail": "File uploaded successfully",
        "file_id": db_file.id,
        "direct_link": f"{base_url}/uploads/{rel_file_path}",
        "download_link": f"{base_url}/files/download/{db_file.id}",
        "original_filename": file.filename,
    }


# ============================================================================
# 4) My Files list
# ============================================================================
@router.get("/my-files", response_model=List[MyFileItem])
def list_my_files(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a lightweight list of the authenticated user’s files."""
    rows: List[FileModel] = (
        db.query(FileModel)
        .filter(FileModel.user_id == current_user.id)
        .order_by(FileModel.id.desc())
        .all()
    )

    base_url = f"{request.url.scheme}://{request.url.netloc}"
    return [
        MyFileItem(
            file_id=f.id,
            original_filename=f.original_filename,
            direct_link=f"{base_url}/uploads/{f.storage_data.get('path')}",
        )
        for f in rows
    ]


# ============================================================================
# 5) Single DOWNLOAD
# ============================================================================
@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Stream the requested file back to the client."""
    # ------------- authorisation (header OR token param) -------------
    session_user: Optional[User] = None
    if token:
        from app.db.models.user_session import UserSession

        session = db.query(UserSession).filter(UserSession.token == token).first()
        if session:
            session_user = db.query(User).filter(User.id == session.user_id).first()

    if not session_user:
        from app.dependencies.auth import get_current_user as _dep

        session_user = _dep(Request(scope={"type": "http"}), db)

    # ------------- fetch file row -----------------------------------
    db_file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found.")

    if db_file.user_id != session_user.id and not is_super_admin(session_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    rel_path: str = db_file.storage_data.get("path", "")
    abs_path = disk_path(rel_path)
    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="File missing on disk.")

    def file_iterator(chunk_size: int = 8192):
        with open(abs_path, "rb") as fh:
            while chunk := fh.read(chunk_size):
                yield chunk

    return StreamingResponse(
        file_iterator(),
        media_type=db_file.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{db_file.original_filename or rel_path}"'
            )
        },
    )
