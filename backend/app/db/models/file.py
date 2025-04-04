import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Enum,
    func,
    ForeignKey
)
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.models.storage_enums import FileType, StorageType


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True)
    file_type = Column(Enum(FileType), nullable=False, default=FileType.BASE)

    # For your chosen DB, either use a generic JSON or a DB-specific type:
    storage_type = Column(Enum(StorageType), nullable=False, default=StorageType.LOCAL)
    # We'll store any details needed for that storage in a JSON field
    # e.g. { "path": "/local/path/to/file" } for LOCAL
    #      { "bucket": "my-bucket", "key": "myfile.png", "region": "us-east-1" } for AWS_S3
    storage_data = Column(SQLiteJSON, default={})

    content_type = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Linking an uploaded file to a user (nullable => guest upload possible)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploader = relationship("User", backref="files", foreign_keys=[user_id])

    # Store the original filename so we can return it on download
    original_filename = Column(String, nullable=True)

    # Example usage:
    # - If storage_type = StorageType.LOCAL, storage_data might be { "path": "some-random-16-chars.ext" }
    # - If storage_type = StorageType.AWS_S3, storage_data might be { ... }
