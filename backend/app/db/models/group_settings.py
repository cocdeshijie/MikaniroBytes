from sqlalchemy import Column, Integer, BigInteger, ForeignKey
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class GroupSettings(Base):
    __tablename__ = "group_settings"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"))

    # Stored as simple JSON list. Using default=list avoids the
    # “mutable default” foot‑gun when someone mutates the list in place.
    allowed_extensions = Column(SQLiteJSON, default=list)

    max_file_size = Column(BigInteger, default=10_000_000)      # bytes
    max_storage_size = Column(BigInteger, nullable=True)        # None => unlimited

    group = relationship("Group", back_populates="settings")
