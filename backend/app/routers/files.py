from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File as FastFile,
    HTTPException,
    Request,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import os
import time
import hashlib
import secrets

from pydantic import BaseModel

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
        size=len(contents),                    # ← NEW
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
    Return a lightweight list of the authenticated user’s files so the
    dashboard can render them.

    Shape expected by the front‑end (see `MyFileTab.tsx`):
      [
        {
          "file_id": 123,
          "original_filename": "photo.jpg",
          "direct_link": "https://…/uploads/abcd1234.jpg"
        },
        …
      ]
    """
    rows: List[FileModel] = (
        db.query(FileModel)
        .filter(FileModel.user_id == current_user.id)
        .order_by(FileModel.id.desc())          # latest first
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

    print("items", items)
    return items


# --------------------------------------------------------------------------- #
#                          Download / stream a file                           #
# --------------------------------------------------------------------------- #
@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
):
    """
    Stream the requested file back to the client.
    (Currently no auth check – feel free to adjust to your policy.)
    """
    db_file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found.")

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
        headers={"Content-Disposition": f'attachment; filename="{db_file.original_filename or rel_path}"'},
    )
