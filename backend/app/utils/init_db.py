from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.group_settings import GroupSettings
from app.db.models.system_settings import SystemSettings
from app.utils.security import hash_password


def init_db(db: Session) -> None:
    """
    Run once at server start-up.

    • Ensure the SUPER_ADMIN and GUEST groups and their bootstrap users.
    • Ensure at least one *normal* group (neither SUPER_ADMIN nor GUEST).
    • Ensure exactly one SystemSettings row (with valid fallback group).
    """
    # Check if database is already initialized
    if db.query(Group).count() > 0:
        print("Database already initialised – skipping bootstrap.")
        return

    print("Initialising database with default values…")

    # ------------------------------------------------------------------
    # 1) SUPER_ADMIN group
    # ------------------------------------------------------------------
    super_admin_group = db.query(Group).filter(Group.name == "SUPER_ADMIN").first()
    if not super_admin_group:
        super_admin_group = Group(name="SUPER_ADMIN")
        super_admin_group.settings = GroupSettings(
            allowed_extensions=[],
            max_file_size=None,  # unlimited
            max_storage_size=None,  # unlimited
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
        print("Created super-admin user: admin / admin")

    # ------------------------------------------------------------------
    # 3) GUEST group  (special, cannot be deleted or assigned)
    # ------------------------------------------------------------------
    guest_group = db.query(Group).filter(Group.name == "GUEST").first()
    if not guest_group:
        guest_group = Group(name="GUEST")
        guest_group.settings = GroupSettings(
            allowed_extensions=["jpg", "png", "gif", "pdf"],
            max_file_size=5 * 1024 * 1024,           # 5 MB
            max_storage_size=10 * 1024 * 1024 * 1024  # 10 GB
        )
        db.add(guest_group)
        db.commit()
        db.refresh(guest_group)

    guest_user = db.query(User).filter(User.username == "guest").first()
    if not guest_user:
        guest_user = User(
            username="guest",
            hashed_password=None,          # no login
            group_id=guest_group.id,
        )
        db.add(guest_user)
        db.commit()
        print("Created guest user")

    # ------------------------------------------------------------------
    # 4) Make sure **some** normal group exists
    #     ("normal" = not SUPER_ADMIN and not GUEST)
    # ------------------------------------------------------------------
    normal_group = (
        db.query(Group)
        .filter(and_(Group.name.notin_(["SUPER_ADMIN", "GUEST"])))
        .order_by(Group.id)
        .first()
    )

    if not normal_group:
        # None exist – create fallback USERS group
        normal_group = Group(name="USERS")
        normal_group.settings = GroupSettings(
            allowed_extensions=[],
            max_file_size=10 * 1024 * 1024,       # 10 MB
            max_storage_size=1 * 1024 * 1024 * 1024,   # 1 GB
        )
        db.add(normal_group)
        db.commit()
        db.refresh(normal_group)

    # ------------------------------------------------------------------
    # 5) SystemSettings row
    # ------------------------------------------------------------------
    system_settings = db.query(SystemSettings).first()
    if not system_settings:
        system_settings = SystemSettings(
            registration_enabled=True,
            public_upload_enabled=False,
            default_user_group_id=normal_group.id,
            upload_path_template="{Y}/{m}",
        )
        db.add(system_settings)
        db.commit()
    else:
        # Validate stored default group + ensure upload_path_template
        if not system_settings.default_user_group_id:
            system_settings.default_user_group_id = normal_group.id
        if not system_settings.upload_path_template:
            system_settings.upload_path_template = "{Y}/{m}"
        db.add(system_settings)
        db.commit()

    print("Database initialized successfully.")