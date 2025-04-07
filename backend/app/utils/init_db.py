from sqlalchemy.orm import Session
from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.group_settings import GroupSettings
from app.db.models.system_settings import SystemSettings
from app.utils.security import hash_password


def init_db(db: Session):
    """
    Called once at server startup, if DB is empty or needs default initialization.
    - Ensures SUPER_ADMIN group + user
    - Ensures a default "USERS" group
    - Ensures there's exactly one row in SystemSettings,
      sets default_user_group_id to the "USERS" group
    """

    # 1) Ensure SUPER_ADMIN group
    super_admin_group = db.query(Group).filter(Group.name == "SUPER_ADMIN").first()
    if not super_admin_group:
        super_admin_group = Group(name="SUPER_ADMIN")
        super_admin_group.settings = GroupSettings(
            allowed_extensions=["jpg", "png", "gif", "zip", "pdf"],
            max_file_size=None,  # or some large number
            max_storage_size=None,  # unlimited
        )
        db.add(super_admin_group)
        db.commit()
        db.refresh(super_admin_group)

    # 2) Ensure a super admin user
    existing_superadmin_user = (
        db.query(User)
        .filter(User.group_id == super_admin_group.id)
        .first()
    )
    if not existing_superadmin_user:
        # For demo, name=admin / pass=admin
        username = "admin"
        hashed_password = hash_password("admin")
        new_user = User(
            username=username,
            hashed_password=hashed_password,
            group_id=super_admin_group.id
        )
        db.add(new_user)
        db.commit()
        print("Created super admin user:", username)

    # 3) Ensure default "USERS" group
    users_group = db.query(Group).filter(Group.name == "USERS").first()
    if not users_group:
        users_group = Group(name="USERS")
        users_group.settings = GroupSettings(
            allowed_extensions=["jpg", "png", "gif"],
            max_file_size=10_000_000,      # 10 MB
            max_storage_size=500_000_000,  # 500 MB total, for example
        )
        db.add(users_group)
        db.commit()
        db.refresh(users_group)

    # 4) Ensure exactly one SystemSettings row
    system_settings = db.query(SystemSettings).first()
    if not system_settings:
        # Create the row
        system_settings = SystemSettings(
            registration_enabled=True,
            public_upload_enabled=False,
            default_user_group_id=users_group.id,
        )
        db.add(system_settings)
        db.commit()
        db.refresh(system_settings)
    else:
        # If it already exists but default_user_group_id is empty, set it
        if not system_settings.default_user_group_id:
            system_settings.default_user_group_id = users_group.id
            db.add(system_settings)
            db.commit()
            db.refresh(system_settings)

    print("Database initialized successfully.")
