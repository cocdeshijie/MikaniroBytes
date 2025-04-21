from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Enum,
    func,
    ForeignKey,
)
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.models.storage_enums import FileType, StorageType


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True)

    # raw size in bytes
    size = Column(Integer, nullable=False, default=0)

    file_type = Column(Enum(FileType), nullable=False, default=FileType.BASE)
    storage_type = Column(
        Enum(StorageType), nullable=False, default=StorageType.LOCAL
    )
    storage_data = Column(SQLiteJSON, default=dict)
    content_type = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,                         # ★ speeds up aggregation queries
    )
    uploader = relationship("User", backref="files", foreign_keys=[user_id])

    original_filename = Column(String, nullable=True)
