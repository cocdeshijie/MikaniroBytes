from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class UserOAuth(Base):
    __tablename__ = "user_oauth_accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))

    provider = Column(String, nullable=False)  # e.g. "github", "google"
    provider_account_id = Column(String, nullable=False)

    # If needed, store tokens or additional data
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)

    user = relationship("User", back_populates="oauth_accounts")
