import io
import os
import time
import zipfile
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.file import File as FileModel
from app.db.models.user import User
from app.db.models.user_session import UserSession
from app.dependencies.auth import get_current_user

router = APIRouter()


# -------------------------------------------------------
# Helpers
# -------------------------------------------------------
def is_super_admin(user: User) -> bool:
    """Return True if the user belongs to SUPER_ADMIN group."""
    return getattr(user.group, "name", "").upper() == "SUPER_ADMIN"


# -------------------------------------------------------
# Request Body Models
# -------------------------------------------------------
class BatchDownloadPayload(BaseModel):
    ids: List[int]


# -------------------------------------------------------
# BATCH DOWNLOAD
# -------------------------------------------------------
@router.post("/batch-download", response_model=None)
def batch_download_files(
        payload: BatchDownloadPayload,  # <--- now a Pydantic model
        request: Request,
        db: Session = Depends(get_db),
        token: Optional[str] = None,
):
    """
    Create an on-the-fly ZIP file for the requested file IDs.

    * Normal users => only own files
    * SUPER_ADMIN => can download any files
    * 'token' param => optional for direct one-click links
    """
    # Try to retrieve user from token param
    current_user: Optional[User] = None
    if token:
        sess = db.query(UserSession).filter(UserSession.token == token).first()
        if sess:
            current_user = db.query(User).filter(User.id == sess.user_id).first()

    # If still no user, fallback to normal get_current_user
    if not current_user:
        current_user = get_current_user(request, db)  # may raise 401

    if not payload.ids:
        raise HTTPException(status_code=400, detail="Empty ids list")

    query = db.query(FileModel).filter(FileModel.id.in_(payload.ids))

    if not is_super_admin(current_user):
        query = query.filter(FileModel.user_id == current_user.id)

    rows = query.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No valid files found")

    # If not admin and we found fewer rows than requested => user tried
    # to download someone else’s file
    if not is_super_admin(current_user) and len(rows) != len(payload.ids):
        raise HTTPException(status_code=403, detail="Some files are not yours")

    # Create ZIP in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        added_names = set()
        for f in rows:
            rel_path = f.storage_data.get("path", "")
            abs_path = os.path.join("uploads", rel_path)
            if not os.path.isfile(abs_path):
                continue  # skip missing files

            arcname = f.original_filename or rel_path
            # ensure uniqueness in ZIP
            if arcname in added_names:
                base, ext = os.path.splitext(arcname)
                arcname = f"{base}_{f.id}{ext}"
            added_names.add(arcname)

            try:
                zf.write(abs_path, arcname)
            except OSError:
                pass

    buf.seek(0)
    filename = f"files_{int(time.time())}.zip"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": "application/zip",
    }
    return StreamingResponse(buf, headers=headers)


# -------------------------------------------------------
# SINGLE DOWNLOAD
# -------------------------------------------------------
@router.get("/download/{file_id}", response_model=None)
def download_file(
        file_id: int,
        token: Optional[str] = None,
        db: Session = Depends(get_db),
):
    """
    Stream a single file back to the client by ID.
    * Normal user => must own the file
    * SUPER_ADMIN => can download any file
    * 'token' param => optional for direct download links
    """
    current_user: Optional[User] = None
    if token:
        # Attempt token-based session
        sess = db.query(UserSession).filter(UserSession.token == token).first()
        if sess:
            current_user = db.query(User).filter(User.id == sess.user_id).first()

    if not current_user:
        from app.dependencies.auth import get_current_user as get_user_dep
        current_user = get_user_dep(None, db)  # might 401

    db_file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found.")

    if db_file.user_id != current_user.id and not is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    rel_path = db_file.storage_data.get("path", "")
    abs_path = os.path.join("uploads", rel_path)
    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="File missing on disk.")

    def file_iterator(chunk_size=8192):
        with open(abs_path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        file_iterator(),
        media_type=db_file.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{db_file.original_filename or rel_path}"'
        },
    )
