
import io
import tarfile
import zipfile

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File as FastFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.system_settings import SystemSettings
from app.dependencies.auth import get_current_user, get_optional_user

from .helpers import store_new_file

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Accept a single file upload and persist it on disk and in the DB.
    - If no session, check public_upload_enabled in system settings.
    - If session is present, the file is tied to the user (owner_id).
    - Otherwise guest user is used.
    """
    settings = db.query(SystemSettings).first()

    # Public upload check
    if current_user is None:
        if settings and not settings.public_upload_enabled:
            raise HTTPException(status_code=403, detail="Public uploads disabled")

    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Determine user_id (or fallback to 'guest' user)
    if current_user:
        owner_id = current_user.id
    else:
        guest_user = db.query(User).filter(User.username == "guest").first()
        owner_id = guest_user.id if guest_user else None

    # Store the file with our helper
    try:
        db_file = store_new_file(
            db=db,
            file_contents=contents,
            original_filename=file.filename,
            owner_id=owner_id,
            settings=settings,
        )
    except ValueError as ex:
        # e.g. if 'Empty file'
        raise HTTPException(status_code=400, detail=str(ex))

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
    archive: UploadFile = FastFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a .zip / .tar / .tar.gz archive and import ALL files inside.
    - The original folder structure is preserved under /uploads.
    - Each imported file row is bound to current_user.
    - Returns a summary of successes/failures.
    """
    settings = db.query(SystemSettings).first()

    name_lower = (archive.filename or "").lower()
    if not (
        name_lower.endswith(".zip") or
        name_lower.endswith(".tar") or
        name_lower.endswith(".tar.gz") or
        name_lower.endswith(".tgz")
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

        # Skip directories, symlinks, etc.
        if not member_name or member_name.endswith("/"):
            return
        # Load contents
        file_data = file_reader.read()
        if not file_data:
            # skip empty
            return

        # We do not do the hashing or DB row here now,
        # just call our shared function
        try:
            store_new_file(
                db=db,
                file_contents=file_data,
                original_filename=member_name,
                owner_id=current_user.id,
                settings=settings,
            )
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
