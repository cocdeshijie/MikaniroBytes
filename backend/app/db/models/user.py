from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)

    group_id = Column(
        Integer,
        ForeignKey("groups.id", ondelete="SET NULL"),
        index=True,                       # ★ speeds up joins / lookups
    )
    group = relationship("Group", back_populates="users")

    oauth_accounts = relationship("UserOAuth", back_populates="user")
