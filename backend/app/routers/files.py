from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import os
import time
import hashlib
import secrets

from app.db.database import get_db
from app.db.models.file import File as FileModel
from app.db.models.storage_enums import StorageType, FileType
from app.db.models.user import User
from app.dependencies.auth import get_optional_user

router = APIRouter()


@router.post("/upload")
def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Accept a single file upload.
    If logged in, link the file to the user.
    If not, store user_id=None (guest).
    Returns the public URL for direct file access, plus a /download link.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Read file contents into memory (careful with large files!)
    file_contents = file.file.read()
    if not file_contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Generate a 16-char hashed name from metadata
    unique_string = f"{file.filename}-{len(file_contents)}-{time.time()}-{secrets.token_hex(8)}"
    hashed_part = hashlib.sha256(unique_string.encode()).hexdigest()[:16]

    # Extract extension
    _, ext = os.path.splitext(file.filename)
    ext = ext.lower()  # e.g. ".jpg"
    hashed_filename = hashed_part + ext

    # Write to local "uploads" directory
    upload_path = os.path.join("uploads", hashed_filename)
    with open(upload_path, "wb") as out_file:
        out_file.write(file_contents)

    # Create a DB record
    db_file = FileModel(
        file_type=FileType.BASE,
        storage_type=StorageType.LOCAL,
        storage_data={"path": hashed_filename},
        content_type=file.content_type or "application/octet-stream",
        user_id=current_user.id if current_user else None,
        original_filename=file.filename,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    # Build full URLs
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    direct_link = f"{base_url}/uploads/{hashed_filename}"
    download_link = f"{base_url}/files/download/{db_file.id}"

    return {
        "detail": "File uploaded successfully",
        "file_id": db_file.id,
        "direct_link": direct_link,
        "download_link": download_link,
        "original_filename": file.filename
    }


@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
):
    """
    Returns a StreamingResponse with Content-Disposition: attachment.
    Preserves the original filename for the user.
    """
    db_file = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Must be local storage
    if db_file.storage_type != StorageType.LOCAL:
        raise HTTPException(status_code=400, detail="Cannot download non-local file")

    hashed_filename = db_file.storage_data.get("path")
    if not hashed_filename:
        raise HTTPException(status_code=400, detail="storage_data.path missing")

    local_path = os.path.join("uploads", hashed_filename)
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    download_name = db_file.original_filename or hashed_filename

    def iterfile(path: str):
        with open(path, "rb") as f:
            yield from f

    response = StreamingResponse(
        iterfile(local_path),
        media_type=db_file.content_type or "application/octet-stream"
    )
    response.headers["Content-Disposition"] = f'attachment; filename="{download_name}"'
    return response
