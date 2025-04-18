from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File as FastFile,
    HTTPException,
    Request,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
import os
import time
import hashlib
import secrets

from app.db.database import get_db
from app.db.models.file import File as FileModel
from app.db.models.storage_enums import StorageType, FileType
from app.db.models.user import User
from app.dependencies.auth import get_optional_user, get_current_user

router = APIRouter()

# --------------------------------------------------------------------------- #
#                               Pydantic models                               #
# --------------------------------------------------------------------------- #
class MyFileItem(BaseModel):
    file_id: int
    original_filename: Optional[str]
    direct_link: str

    class Config:
        orm_mode = True


class BatchDeletePayload(BaseModel):
    ids: List[int]


# --------------------------------------------------------------------------- #
#                         Batch‑delete (static path)                           #
# --------------------------------------------------------------------------- #
@router.delete("/batch-delete")
def batch_delete_files(
    payload: BatchDeletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete multiple files that belong to the current user.
    Body: { "ids": [1,2,3] }
    Returns: { "deleted": [1,2,3] }
    """
    if not payload.ids:
        raise HTTPException(status_code=400, detail="Empty ids list")

    # Only delete files owned by the requester
    rows: List[FileModel] = (
        db.query(FileModel)
        .filter(FileModel.id.in_(payload.ids), FileModel.user_id == current_user.id)
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No matching files found")

    deleted_ids: List[int] = []

    for f in rows:
        # remove file on disk
        rel_path: str = f.storage_data.get("path", "")
        abs_path = os.path.join("uploads", rel_path)
        if os.path.isfile(abs_path):
            try:
                os.remove(abs_path)
            except OSError:
                pass

        deleted_ids.append(f.id)
        db.delete(f)

    db.commit()
    return {"deleted": deleted_ids}


# --------------------------------------------------------------------------- #
#                              Upload a single file                           #
# --------------------------------------------------------------------------- #
@router.post("/upload")
def upload_file(
    request: Request,
    file: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Accept a single file upload (guest *or* authenticated).
    If the user is authenticated we store `user_id`; otherwise `NULL`.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # ------------ store on disk ------------
    unique = f"{file.filename}-{len(contents)}-{time.time()}-{secrets.token_hex(8)}"
    hashed = hashlib.sha256(unique.encode()).hexdigest()[:16]
    _, ext = os.path.splitext(file.filename)
    hashed_name = hashed + ext.lower()

    os.makedirs("uploads", exist_ok=True)
    path = os.path.join("uploads", hashed_name)
    with open(path, "wb") as out:
        out.write(contents)

    # ------------ DB row ------------
    db_file = FileModel(
        size=len(contents),
        file_type=FileType.BASE,
        storage_type=StorageType.LOCAL,
        storage_data={"path": hashed_name},
        content_type=file.content_type or "application/octet-stream",
        user_id=current_user.id if current_user else None,
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


# --------------------------------------------------------------------------- #
#                        Return *this* user’s files list                      #
# --------------------------------------------------------------------------- #
@router.get("/my-files", response_model=List[MyFileItem])
def list_my_files(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a lightweight list of the authenticated user’s files.
    """
    rows: List[FileModel] = (
        db.query(FileModel)
        .filter(FileModel.user_id == current_user.id)
        .order_by(FileModel.id.desc())
        .all()
    )

    base_url = f"{request.url.scheme}://{request.url.netloc}"
    items: List[MyFileItem] = [
        MyFileItem(
            file_id=f.id,
            original_filename=f.original_filename,
            direct_link=f"{base_url}/uploads/{f.storage_data.get('path')}",
        )
        for f in rows
    ]
    return items


# --------------------------------------------------------------------------- #
#                          Download / stream a file                           #
# --------------------------------------------------------------------------- #
@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Stream the requested file back to the client.

    • If a `token` query‑param is provided, we validate it instead of requiring
      an Authorization header.  This is handy for ZIP / batch downloads.
    """
    # auth by header OR token param
    session_user: Optional[User] = None
    if token:
        from app.db.models.user_session import UserSession
        session = db.query(UserSession).filter(UserSession.token == token).first()
        if session:
            session_user = db.query(User).filter(User.id == session.user_id).first()

    # fallback to normal auth dependency
    if not session_user:
        from app.dependencies.auth import get_current_user  # lazy import
        session_user = get_current_user(Request(scope={"type": "http"}), db)

    db_file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found.")

    if db_file.user_id != session_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    rel_path: str = db_file.storage_data.get("path", "")
    abs_path = os.path.join("uploads", rel_path)

    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="File missing on disk.")

    def file_iterator(chunk_size=8192):
        with open(abs_path, "rb") as fh:
            while chunk := fh.read(chunk_size):
                yield chunk

    return StreamingResponse(
        file_iterator(),
        media_type=db_file.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{db_file.original_filename or rel_path}"'
        },
    )
