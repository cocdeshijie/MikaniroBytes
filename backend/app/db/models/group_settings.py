from sqlalchemy import Column, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import relationship
from ..base_class import Base


class GroupSettings(Base):
    __tablename__ = "group_settings"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"))

    # Example toggles & limits
    allowed_extensions = Column(SQLiteJSON, default=["jpg", "png", "gif"])
    max_file_size = Column(Integer, default=10_000_000)  # in bytes, e.g. 10 MB
    # Future expansions: storage preference, concurrency limits, etc.

    group = relationship("Group", back_populates="settings")
