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
from app.db.models.group_settings import GroupSettings
from app.db.models.user import User as UserModel

from app.dependencies.auth import get_current_user, get_optional_user
from app.routers.files.helpers import (
    store_new_file,
    store_file_from_archive,
    guess_file_type_by_extension,
    validate_upload,                 # ★ NEW
    ExceedsSizeLimitError,          # ★ NEW
    ExtensionNotAllowedError,       # ★ NEW
)
from app.utils.preview import generate_preview_in_background, PREVIEW_GENERATORS

UPLOAD_DIR = "uploads"
router = APIRouter()


# Pydantic
class BulkUploadSummary(BaseModel):
    success: int
    failed: int
    result_text: str


# ─────────────────────────────────────────────────────────────────────
#  Single-file upload
# ─────────────────────────────────────────────────────────────────────
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
    Enforces group-specific size limit & allowed_extensions.
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

    # Determine owner + group
    if current_user:
        owner_user = current_user
    else:
        guest_user = db.query(UserModel).filter_by(username="guest").first()
        owner_user = guest_user

    # ★ Enforce group constraints
    group_settings = owner_user.group.settings if owner_user.group else None
    try:
        validate_upload(
            file_data=contents,
            filename=file.filename,
            group_settings=group_settings,
        )
    except ExceedsSizeLimitError as e:
        # 413 = Payload Too Large
        raise HTTPException(status_code=413, detail=str(e))
    except ExtensionNotAllowedError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create the file row
    db_file = store_new_file(
        db=db,
        file_contents=contents,
        original_filename=file.filename,
        owner_id=owner_user.id,
        settings=settings,
    )

    # guess file type
    ftype = guess_file_type_by_extension(db_file.original_filename or "")
    db_file.file_type = ftype
    db.add(db_file)
    db.commit()

    # If recognized as an image => queue preview
    if ftype in PREVIEW_GENERATORS:
        if background_tasks is None:
            raise HTTPException(status_code=500, detail="BackgroundTasks not available")
        background_tasks.add_task(generate_preview_in_background, db_file.id)

    base_url = f"{request.url.scheme}://{request.url.netloc}"
    return {
        "detail": "File uploaded successfully",
        "file_id": db_file.id,
        "direct_link": f"{base_url}/{db_file.storage_data.get('path')}",
        "download_link": f"{base_url}/files/download/{db_file.id}",
        "original_filename": db_file.original_filename,
    }


# ─────────────────────────────────────────────────────────────────────
#  Bulk upload
# ─────────────────────────────────────────────────────────────────────
@router.post("/bulk-upload", response_model=BulkUploadSummary)
async def bulk_upload(
    background_tasks: BackgroundTasks,
    archive: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    .zip/.tar(.gz) extraction.
    We preserve subfolder structure exactly as found in the archive.
    If recognized as an image => queue a preview.

    Now enforces group constraints for each extracted file:
      - If file is too large => skip
      - If extension not allowed => skip
    """
    settings = db.query(SystemSettings).first()
    user_group_settings = current_user.group.settings if current_user.group else None

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

        if not member_name or member_name.endswith("/"):
            return
        file_data = file_reader.read()
        if not file_data:
            return

        # ★ Validate extension & size
        try:
            validate_upload(
                file_data=file_data,
                filename=member_name,  # the "filename" inside the archive
                group_settings=user_group_settings,
            )
        except (ExceedsSizeLimitError, ExtensionNotAllowedError) as exc:
            fail_count += 1
            summary_lines.append(f"{member_name}\t{exc}")
            return

        try:
            new_file = store_file_from_archive(
                db=db,
                file_contents=file_data,
                archive_path=member_name,
                owner_id=current_user.id,
            )
            # guess file type
            ftype = guess_file_type_by_extension(new_file.original_filename or "")
            new_file.file_type = ftype
            db.add(new_file)
            db.commit()
            # If recognized as image => queue preview
            if ftype in PREVIEW_GENERATORS:
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

