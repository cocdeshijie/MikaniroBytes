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


@router.post("/upload")
def upload_file(
    request: Request,
    file: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Accept a single file upload (guest or authenticated).
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
