import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.file import File as FileModel
from app.db.models.user import User
from app.dependencies.auth import get_current_user

router = APIRouter()
UPLOAD_DIR = "uploads"


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────
def disk_path(rel_path: str) -> str:
    return os.path.join(UPLOAD_DIR, rel_path)


def _cleanup_empty_dirs(start: str) -> None:
    """
    Given *start* as an absolute file path that has just been deleted,
    remove any empty parent directories until we reach UPLOAD_DIR.
    """
    root = os.path.abspath(UPLOAD_DIR)
    parent = os.path.dirname(start)
    while os.path.abspath(parent).startswith(root) and os.path.abspath(parent) != root:
        try:
            if not os.listdir(parent):
                os.rmdir(parent)
                parent = os.path.dirname(parent)
            else:
                break
        except OSError:
            break


# ─────────────────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────────────────
class MyFileItem(BaseModel):
    file_id: int
    original_filename: Optional[str] = None
    direct_link: str


class BatchDeletePayload(BaseModel):
    ids: List[int]


# ─────────────────────────────────────────────────────────────────────
# Batch DELETE
# ─────────────────────────────────────────────────────────────────────
@router.delete("/batch-delete")
def batch_delete_files(
    payload: BatchDeletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete multiple files in one request.

    Normal users => can only delete their own files.
    SUPER_ADMIN => can delete any files.

    We now call delete_physical_files(...) to ensure previews are also removed.
    """
    if not payload.ids:
        raise HTTPException(status_code=400, detail="Empty ids list")

    is_admin = (current_user.group and current_user.group.name == "SUPER_ADMIN")

    q = db.query(FileModel).filter(FileModel.id.in_(payload.ids))
    if not is_admin:
        q = q.filter(FileModel.user_id == current_user.id)

    rows = q.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No matching files found")

    #
    # -- NEW LOGIC: Instead of manually removing main files from disk,
    #    we call delete_physical_files(rows). This handles both the file
    #    and all previews.
    #
    from app.routers.admin.helpers import delete_physical_files
    delete_physical_files(rows)   # physically remove main & preview files

    # Now remove the DB rows:
    for f in rows:
        db.delete(f)
    db.commit()

    deleted_ids = [f.id for f in rows]
    return {"deleted": deleted_ids}


# ─────────────────────────────────────────────────────────────────────
# My Files list
# ─────────────────────────────────────────────────────────────────────
@router.get("/my-files", response_model=List[MyFileItem])
def list_my_files(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a lightweight list of the current user's files.
    """
    rows = (
        db.query(FileModel)
        .filter(FileModel.user_id == current_user.id)
        .order_by(FileModel.id.desc())
        .all()
    )

    base_url = f"{request.url.scheme}://{request.url.netloc}"

    out: List[MyFileItem] = []
    for f in rows:
        out.append(
            MyFileItem(
                file_id=f.id,
                original_filename=f.original_filename,
                direct_link=f"{base_url}/uploads/{f.storage_data.get('path')}",
            )
        )
    return out


# ─────────────────────────────────────────────────────────────────────
# Bulk result retrieval
# ─────────────────────────────────────────────────────────────────────
@router.get("/bulk-result/{user_id}/{fname}")
def get_bulk_result(
    user_id: int,
    fname: str,
    current_user: User = Depends(get_current_user),
):
    """
    Serve a text result file back to its owner.
    SUPER_ADMIN may fetch anyone's file.
    """
    is_admin = (current_user.group and current_user.group.name == "SUPER_ADMIN")
    if user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")

    path = Path(UPLOAD_DIR) / f"user_{user_id}" / fname
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(path, filename=fname, media_type="text/plain")
