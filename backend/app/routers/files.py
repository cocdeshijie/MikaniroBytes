import hashlib
import os
import secrets
import time
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File as FastFile,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.file import File as FileModel
from app.db.models.storage_enums import FileType, StorageType
from app.db.models.user import User
from app.dependencies.auth import get_current_user, get_optional_user

# -----------------------------------------------------------------------------
# router
# -----------------------------------------------------------------------------
router = APIRouter()

UPLOAD_DIR = "uploads"


# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------
def is_super_admin(user: User) -> bool:
    """
    Detect if *user* has global privileges.

    Adapt the implementation to your schema if necessary:
    * a boolean column  ->  return user.is_admin
    * a role attribute   ->  return user.role == "SUPER_ADMIN"
    * a group relation   ->  return getattr(user.group, "name", "") == "SUPER_ADMIN"
    """
    return getattr(user.group, "name", "").upper() == "SUPER_ADMIN"


def disk_path(rel_path: str) -> str:
    """Convert relative DB path → absolute OS path."""
    return os.path.join(UPLOAD_DIR, rel_path)


# -----------------------------------------------------------------------------
# pydantic models (unchanged except re‑ordered)
# -----------------------------------------------------------------------------
class MyFileItem(BaseModel):
    file_id: int
    original_filename: Optional[str]
    direct_link: str

    class Config:
        orm_mode = True


class BatchDeletePayload(BaseModel):
    ids: List[int]


# -----------------------------------------------------------------------------
# 1) batch‑delete --------------------------------------------------------------
# -----------------------------------------------------------------------------
@router.delete("/batch-delete")
def batch_delete_files(
    payload: BatchDeletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete multiple files.

    * **Normal users** – may only delete their own uploads.
    * **SUPER_ADMIN** – may delete *any* files passed in the `ids` list.
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

    deleted_ids: List[int] = []

    for f in rows:
        rel_path: str = f.storage_data.get("path", "")
        abs_path = disk_path(rel_path)

        if os.path.isfile(abs_path):
            try:
                os.remove(abs_path)
            except OSError:
                # If the file is already gone we still want to remove the DB row
                pass

        deleted_ids.append(f.id)
        db.delete(f)

    db.commit()
    return {"deleted": deleted_ids}


# -----------------------------------------------------------------------------
# 2) upload single file (unchanged)
# -----------------------------------------------------------------------------
@router.post("/upload")
def upload_file(
    request: Request,
    file: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Accept a single file upload (guest *or* authenticated).
    Anonymous uploads are attributed to the permanent **guest** account.
    """
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

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    path = os.path.join(UPLOAD_DIR, hashed_name)
    with open(path, "wb") as out:
        out.write(contents)

    # ---------------- figure out owner ----------------
    owner_id: Optional[int]
    if current_user:
        owner_id = current_user.id
    else:
        guest = db.query(User).filter(User.username == "guest").first()
        owner_id = guest.id if guest else None

    # ---------------- DB row ----------------
    db_file = FileModel(
        size=len(contents),
        file_type=FileType.BASE,
        storage_type=StorageType.LOCAL,
        storage_data={"path": hashed_name},
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
        "direct_link": f"{base_url}/uploads/{hashed_name}",
        "download_link": f"{base_url}/files/download/{db_file.id}",
        "original_filename": file.filename,
    }


# -----------------------------------------------------------------------------
# 3) list *this* user’s files (unchanged)
# -----------------------------------------------------------------------------
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


# -----------------------------------------------------------------------------
# 4) download / stream a file (unchanged)
# -----------------------------------------------------------------------------
@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Stream the requested file back to the client.

    • If a `token` query‑param is provided, we validate it instead of an
      Authorization header.  Handy for ZIP / batch downloads.
    """
    # ------------- authorisation (header OR token param) -------------
    session_user: Optional[User] = None
    if token:
        from app.db.models.user_session import UserSession

        session = (
            db.query(UserSession).filter(UserSession.token == token).first()
        )
        if session:
            session_user = (
                db.query(User).filter(User.id == session.user_id).first()
            )

    if not session_user:
        from app.dependencies.auth import get_current_user as _dep

        session_user = _dep(Request(scope={"type": "http"}), db)

    # ------------- fetch file row -------------
    db_file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found.")

    if db_file.user_id != session_user.id:
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
