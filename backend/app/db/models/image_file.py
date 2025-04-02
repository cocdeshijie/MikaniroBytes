from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from ..base_class import Base


class ImageFile(Base):
    __tablename__ = "image_files"

    # We'll store this row's primary key as the same as the "files" table ID
    id = Column(Integer, ForeignKey("files.id"), primary_key=True)

    # Example metadata for images:
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    # Could also add EXIF data, orientation, etc.

    # Relationship back to the parent File
    parent_file = relationship("File", backref="image_meta")
