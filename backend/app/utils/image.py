import os
import io
from PIL import Image
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models.file import File
from app.db.models.file_preview import FilePreview

PREVIEW_DIR = "uploads/previews"
os.makedirs(PREVIEW_DIR, exist_ok=True)


def generate_image_preview(file_id: int):
    """
    Background task that:
    1) Loads the File from DB
    2) Opens the file from disk
    3) Creates a 256x256 (max) thumbnail
    4) Saves it into 'uploads/previews'
    5) Creates a FilePreview row
    6) Updates File.has_preview and File.default_preview_path
    """
    db = SessionLocal()
    try:
        db_file = db.query(File).filter(File.id == file_id).first()
        if not db_file:
            return  # File not found in DB

        rel_path = db_file.storage_data.get("path")
        if not rel_path:
            return  # No path info

        abs_path = os.path.join("uploads", rel_path)
        if not os.path.isfile(abs_path):
            return  # File missing on disk

        # Open the image via Pillow
        with Image.open(abs_path) as img:
            # Convert to RGB or RGBA to avoid issues with 'P' or 'CMYK'
            img = img.convert("RGB")

            # Calculate 256x256 thumbnail
            img.thumbnail((256, 256))

            # For the preview file name, you can do something unique or just file_id-based
            base_name = f"preview_{file_id}.jpg"
            preview_abs = os.path.join(PREVIEW_DIR, base_name)

            img.save(preview_abs, format="JPEG", optimize=True)

            # Save to DB as a new FilePreview
            preview_row = FilePreview(
                file_id=db_file.id,
                preview_type="thumbnail_256",
                storage_path=os.path.join("previews", base_name),
                width=img.width,
                height=img.height,
            )
            db.add(preview_row)

            # Update main file
            db_file.has_preview = True
            db_file.default_preview_path = preview_row.storage_path

            db.commit()

    finally:
        db.close()


def is_image_filename(filename: str) -> bool:
    """
    Very naive check based on file extension.
    In production, consider using python-magic or other MIME-check.
    """
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in ["jpg", "jpeg", "png", "gif", "bmp", "webp"]
