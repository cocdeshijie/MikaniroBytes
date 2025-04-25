import hashlib
import io
import os
import secrets
import tarfile
import time
import zipfile
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File as FastFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.file import File as FileModel
from app.db.models.storage_enums import FileType, StorageType
from app.db.models.system_settings import SystemSettings
from app.dependencies.auth import get_current_user, get_optional_user

UPLOAD_DIR = "uploads"
router = APIRouter()


# Pydantic
class BulkUploadSummary(BaseModel):
    success: int
    failed: int
    result_text: str


# Helpers
def render_path_template(template: str, now: datetime) -> str:
    """
    Render {Y}, {m}, {d}, {H}, {M}, {S} tokens in *template* using *now*.
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
    """
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

    # Determine sub-directory from template
    template = (settings.upload_path_template if settings and settings.upload_path_template else "{Y}/{m}")
    rel_dir = render_path_template(template, datetime.utcnow())
    target_dir = os.path.join(UPLOAD_DIR, rel_dir)
    os.makedirs(target_dir, exist_ok=True)

    # Hashed file name
    uniq = f"{file.filename}-{len(contents)}-{time.time()}-{secrets.token_hex(8)}"
    hashed = hashlib.sha256(uniq.encode()).hexdigest()[:16]
    _, ext = os.path.splitext(file.filename)
    hashed_name = hashed + ext.lower()

    rel_file_path = os.path.join(rel_dir, hashed_name) if rel_dir else hashed_name
    abs_file_path = os.path.join(target_dir, hashed_name)

    with open(abs_file_path, "wb") as out:
        out.write(contents)

    # Determine owner
    owner_id = None
    if current_user:
        owner_id = current_user.id
    else:
        guest = db.query(User).filter(User.username == "guest").first()
        owner_id = guest.id if guest else None

    # Insert DB row
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
    name_lower = (archive.filename or "").lower()
    if not (name_lower.endswith(".zip") or name_lower.endswith(".tar") or name_lower.endswith(".tar.gz") or name_lower.endswith(".tgz")):
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
        safe_name = member_name.lstrip("/").replace("..", "")
        if not safe_name or safe_name.endswith("/"):
            return  # skip directories
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
                f_out.write(file_reader.read())
        except Exception as exc:
            fail_count += 1
            summary_lines.append(f"{safe_name}\t{exc}")
            return

        # Write DB row
        db.add(
            FileModel(
                size=target_abs.stat().st_size,
                file_type=FileType.BASE,
                storage_type=StorageType.LOCAL,
                storage_data={"path": safe_name},
                content_type="application/octet-stream",
                user_id=current_user.id,
                original_filename=Path(safe_name).name,
            )
        )
        ok_count += 1

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
                    file_reader = tf.extractfile(member)
                    if file_reader:
                        _import_file(member.name, file_reader)
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
