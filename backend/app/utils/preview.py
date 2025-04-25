from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models.file import File, FileType
from app.utils.preview_handlers.image_preview import generate_image_thumbnail

"""
This module acts as a 'router' or 'pipeline' for preview generation.
We can easily add more specialized handlers (PDF, 3D, etc.)
by registering them in PREVIEW_GENERATORS below.
"""

PREVIEW_GENERATORS = {
    FileType.IMAGE: generate_image_thumbnail,
    # e.g. FileType.PDF: generate_pdf_preview,
    #      FileType.THREE_D: generate_3d_preview,
}


def generate_preview_in_background(file_id: int):
    """
    This is the function you call from a FastAPI background task.
    1. Open a fresh DB session
    2. Load the File
    3. Find a matching preview generator for file_type
    4. Generate and commit preview
    """
    db = SessionLocal()
    try:
        db_file = db.query(File).filter(File.id == file_id).first()
        if not db_file:
            return  # No such file

        generator_func = PREVIEW_GENERATORS.get(db_file.file_type)
        if not generator_func:
            # No generator for this type => skip
            return

        # Generate preview
        generator_func(db, db_file)

        db.commit()
    finally:
        db.close()
