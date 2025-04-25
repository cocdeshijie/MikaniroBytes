import io
import tarfile
import zipfile

from fastapi import (
    APIRouter, Depends, HTTPException, Request,
    UploadFile, File as FastFile, BackgroundTasks
)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.system_settings import SystemSettings
from app.db.models.storage_enums import FileType
from app.dependencies.auth import get_current_user, get_optional_user

from .helpers import store_new_file, store_file_from_archive
from app.utils.image import is_image_filename
from app.utils.preview import generate_preview_in_background

UPLOAD_DIR = "uploads"
router = APIRouter()


# Pydantic
class BulkUploadSummary(BaseModel):
    success: int
    failed: int
    result_text: str


@router.post("/upload")
def upload_file(
    request: Request,
    file: UploadFile = FastFile(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Single file upload, plus optional preview generation for images.
    """
    settings = db.query(SystemSettings).first()

    # Check public upload if no user
    if current_user is None:
        if settings and not settings.public_upload_enabled:
            raise HTTPException(status_code=403, detail="Public uploads disabled")

    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Determine owner
    if current_user:
        owner_id = current_user.id
    else:
        guest_user = db.query(User).filter(User.username == "guest").first()
        owner_id = guest_user.id if guest_user else None

    # Create the file row
    db_file = store_new_file(
        db=db,
        file_contents=contents,
        original_filename=file.filename,
        owner_id=owner_id,
        settings=settings,
    )

    # If it's recognized as an image, set file_type and schedule preview
    if is_image_filename(db_file.original_filename or ""):
        db_file.file_type = FileType.IMAGE
        db.add(db_file)
        db.commit()

        if background_tasks is None:
            raise HTTPException(status_code=500, detail="BackgroundTasks not available")

        background_tasks.add_task(generate_preview_in_background, db_file.id)

    base_url = f"{request.url.scheme}://{request.url.netloc}"
    return {
        "detail": "File uploaded successfully",
        "file_id": db_file.id,
        "direct_link": f"{base_url}/uploads/{db_file.storage_data.get('path')}",
        "download_link": f"{base_url}/files/download/{db_file.id}",
        "original_filename": db_file.original_filename,
    }


@router.post("/bulk-upload", response_model=BulkUploadSummary)
async def bulk_upload(
    background_tasks: BackgroundTasks,
    archive: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    .zip/.tar(.gz) extraction.
    We preserve the subfolder structure exactly as it appears.
    If recognized as an image => queue a preview.
    """
    settings = db.query(SystemSettings).first()

    name_lower = (archive.filename or "").lower()
    if not (
        name_lower.endswith(".zip")
        or name_lower.endswith(".tar")
        or name_lower.endswith(".tar.gz")
        or name_lower.endswith(".tgz")
    ):
        raise HTTPException(400, "Only .zip or .tar(.gz) are accepted.")

    data = await archive.read()
    if not data:
        raise HTTPException(400, "Uploaded archive is empty.")

    buffer = io.BytesIO(data)

    summary_lines: list[str] = []
    ok_count = 0
    fail_count = 0

    def _import_file(member_name: str, file_reader: io.BufferedReader):
        nonlocal ok_count, fail_count

        # If member_name ends with "/" or something, skip
        if not member_name or member_name.endswith("/"):
            return
        file_data = file_reader.read()
        if not file_data:
            return

        try:
            # store the file exactly as in the archive
            new_file = store_file_from_archive(
                db=db,
                file_contents=file_data,
                archive_path=member_name,
                owner_id=current_user.id
            )
            # If recognized as image => mark as IMAGE + queue preview
            if is_image_filename(new_file.original_filename):
                new_file.file_type = FileType.IMAGE
                db.add(new_file)
                db.commit()
                background_tasks.add_task(generate_preview_in_background, new_file.id)

            ok_count += 1
        except Exception as exc:
            fail_count += 1
            summary_lines.append(f"{member_name}\t{exc}")

    # Decompress
    try:
        if name_lower.endswith(".zip"):
            with zipfile.ZipFile(buffer) as zf:
                for member in zf.infolist():
                    if member.is_dir():
                        continue
                    with zf.open(member) as r:
                        _import_file(member.filename, r)
        else:
            buffer.seek(0)
            mode = "r:gz" if (name_lower.endswith(".tar.gz") or name_lower.endswith(".tgz")) else "r:"
            with tarfile.open(fileobj=buffer, mode=mode) as tf:
                for member in tf.getmembers():
                    if member.isdir() or member.islnk() or member.issym():
                        continue
                    f_reader = tf.extractfile(member)
                    if f_reader:
                        _import_file(member.name, f_reader)
    except Exception as exc:
        raise HTTPException(400, f"Archive error: {exc}")

    db.commit()

    summary_lines.insert(0, f"{ok_count}/{ok_count + fail_count} success")
    if fail_count:
        summary_lines.insert(1, f"{fail_count} failed\n")
    report_text = "\n".join(summary_lines) or "Nothing imported."

    return BulkUploadSummary(
        success=ok_count,
        failed=fail_count,
        result_text=report_text,
    )
