from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.group_settings import GroupSettings
from app.db.models.system_settings import SystemSettings
from app.utils.security import hash_password


def init_db(db: Session) -> None:
    """
    Run once at server start‑up.

    • Ensure the SUPER_ADMIN group and at least one super‑admin user.
    • Ensure there is **at least one** non‑admin group.
      – If none exist we create a fallback group called “USERS”.
    • Ensure exactly one SystemSettings row and make sure its
      default_user_group_id points to a valid non‑admin group.
    """

    # ------------------------------------------------------------------
    # 1) SUPER_ADMIN group
    # ------------------------------------------------------------------
    super_admin_group = db.query(Group).filter(Group.name == "SUPER_ADMIN").first()
    if not super_admin_group:
        super_admin_group = Group(name="SUPER_ADMIN")
        super_admin_group.settings = GroupSettings(
            allowed_extensions=["jpg", "png", "gif", "zip", "pdf"],
            max_file_size=None,
            max_storage_size=None,
        )
        db.add(super_admin_group)
        db.commit()
        db.refresh(super_admin_group)

    # ------------------------------------------------------------------
    # 2) SUPER_ADMIN user (username=admin / password=admin for demo)
    # ------------------------------------------------------------------
    existing_admin_user = (
        db.query(User).filter(User.group_id == super_admin_group.id).first()
    )
    if not existing_admin_user:
        new_user = User(
            username="admin",
            hashed_password=hash_password("admin"),
            group_id=super_admin_group.id,
        )
        db.add(new_user)
        db.commit()
        print("Created super‑admin user: admin / admin")

    # ------------------------------------------------------------------
    # 3) Make sure **some** non‑admin group exists
    # ------------------------------------------------------------------
    non_admin_group = (
        db.query(Group)
        .filter(and_(Group.id != super_admin_group.id))
        .order_by(Group.id)
        .first()
    )

    if not non_admin_group:
        # None exist – create a sensible fallback
        non_admin_group = Group(name="USERS")
        non_admin_group.settings = GroupSettings(
            allowed_extensions=["jpg", "png", "gif"],
            max_file_size=10_000_000,       # 10 MB
            max_storage_size=500_000_000,   # 500 MB total
        )
        db.add(non_admin_group)
        db.commit()
        db.refresh(non_admin_group)

    # ------------------------------------------------------------------
    # 4) SystemSettings row – ensure it exists and references a valid
    #    *non‑admin* default_user_group_id.
    # ------------------------------------------------------------------
    system_settings = db.query(SystemSettings).first()
    if not system_settings:
        system_settings = SystemSettings(
            registration_enabled=True,
            public_upload_enabled=False,
            default_user_group_id=non_admin_group.id,
        )
        db.add(system_settings)
        db.commit()
    else:
        # If the stored default group is missing or points to a deleted group
        if not system_settings.default_user_group_id:
            system_settings.default_user_group_id = non_admin_group.id
            db.add(system_settings)
            db.commit()
        else:
            # validate the referenced group still exists & isn’t SUPER_ADMIN
            current = db.query(Group).filter(
                Group.id == system_settings.default_user_group_id
            ).first()
            if not current or current.name == "SUPER_ADMIN":
                system_settings.default_user_group_id = non_admin_group.id
                db.add(system_settings)
                db.commit()

    print("Database initialized successfully.")
