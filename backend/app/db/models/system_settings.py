from sqlalchemy import Column, Integer, Boolean

from app.db.base_class import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True)

    # Global toggles
    registration_enabled = Column(Boolean, default=True)
    public_upload_enabled = Column(Boolean, default=False)
    # You could also store global storage configs or any other system-wide flags.
