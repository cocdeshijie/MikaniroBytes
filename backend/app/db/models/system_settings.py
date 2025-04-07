from sqlalchemy import Column, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True)

    # Global toggles
    registration_enabled = Column(Boolean, default=True)
    public_upload_enabled = Column(Boolean, default=False)

    # If set, newly registered users go into this group
    default_user_group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    default_user_group = relationship("Group", foreign_keys=[default_user_group_id])
