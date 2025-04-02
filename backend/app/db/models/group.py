from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from ..base_class import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)  # e.g. "SUPER_ADMIN", "FREE_USER", "PREMIUM"

    # Relationship to GroupSettings (1-to-1 or 1-to-many if you want versions)
    settings = relationship("GroupSettings", uselist=False, back_populates="group")

    # Relationship to users in this group
    users = relationship("User", back_populates="group")
