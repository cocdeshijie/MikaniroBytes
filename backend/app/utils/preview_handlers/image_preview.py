import os
from PIL import Image
from sqlalchemy.orm import Session

from app.db.models.file import File
from app.db.models.file_preview import FilePreview

PREVIEW_DIR = "previews"
os.makedirs(PREVIEW_DIR, exist_ok=True)


def generate_image_thumbnail(db: Session, db_file: File, thumb_size=256):
    """
    Save a preview in /previews folder, named <hashed>_256.<ext>.
    Then store or update FilePreview and mark db_file.has_preview = True, etc.
    """
    rel_path = db_file.storage_data.get("path")
    if not rel_path:
        return

    abs_path = os.path.join("uploads", rel_path)
    if not os.path.isfile(abs_path):
        return

    # get hashed file name from rel_path (just the final part)
    file_name = os.path.basename(rel_path)
    base, ext = os.path.splitext(file_name)
    if not ext:
        ext = ".jpg"

    preview_filename = f"{base}_{thumb_size}{ext.lower()}"
    preview_abs = os.path.join(PREVIEW_DIR, preview_filename)
    preview_rel = preview_filename  # storage_path = "myhash_256.jpg"

    try:
        with Image.open(abs_path) as img:
            img = img.convert("RGB")
            img.thumbnail((thumb_size, thumb_size))
            fmt = "JPEG" if ext.lower() not in [".png"] else "PNG"
            img.save(preview_abs, format=fmt, optimize=True)

        existing = (
            db.query(FilePreview)
              .filter(FilePreview.file_id == db_file.id,
                      FilePreview.preview_type == f"thumbnail_{thumb_size}")
              .first()
        )
        if not existing:
            fp = FilePreview(
                file_id=db_file.id,
                preview_type=f"thumbnail_{thumb_size}",
                storage_path=preview_rel,   # e.g. "abc123_256.jpg"
                width=img.width,
                height=img.height,
            )
            db.add(fp)
        else:
            existing.storage_path = preview_rel
            existing.width = img.width
            existing.height = img.height

        db_file.has_preview = True
        db_file.default_preview_path = preview_rel  # e.g. "abc123_256.jpg"
    except:
        pass
