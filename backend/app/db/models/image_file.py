from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class ImageFile(Base):
    __tablename__ = "image_files"

    # Share PK with parent “files” row – cascade delete keeps us tidy
    id = Column(
        Integer,
        ForeignKey("files.id", ondelete="CASCADE"),
        primary_key=True,
    )

    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    parent_file = relationship("File", backref="image_meta")
