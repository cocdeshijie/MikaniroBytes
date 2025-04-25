from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class FilePreview(Base):
    __tablename__ = "file_previews"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    preview_type = Column(String, nullable=False, default="thumbnail")  # e.g. "thumbnail", "medium", "big"
    storage_path = Column(String, nullable=False)  # where the preview is saved
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_file = relationship("File", back_populates="previews")
