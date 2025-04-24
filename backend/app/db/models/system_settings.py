from sqlalchemy import Column, Integer, Boolean, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True)

    # ────────────────────────────────────────────────────────────────
    #  Global toggles
    # ────────────────────────────────────────────────────────────────
    registration_enabled = Column(Boolean, default=True)
    public_upload_enabled = Column(Boolean, default=False)

    # ────────────────────────────────────────────────────────────────
    #  Default group for newly-registered users
    # ────────────────────────────────────────────────────────────────
    default_user_group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    default_user_group = relationship("Group", foreign_keys=[default_user_group_id])

    # ────────────────────────────────────────────────────────────────
    #  Upload path template
    #     e.g.  "{Y}/{m}"  →  uploads/2025/04/<file>
    #            "{Y}/{m}/{d}" → uploads/2025/04/27/<file>
    #  Placeholders follow strftime semantics:
    #     {Y}  %Y   4-digit year
    #     {m}  %m   2-digit month
    #     {d}  %d   2-digit day
    #     {H}  %H   2-digit hour (24h)
    #     {M}  %M   2-digit minute
    #     {S}  %S   2-digit second
    # ────────────────────────────────────────────────────────────────
    upload_path_template = Column(String, nullable=False, default="{Y}/{m}")
