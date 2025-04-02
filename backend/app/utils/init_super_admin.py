from sqlalchemy.orm import Session
from app.db.models.user import User
from app.db.models.group import Group
from app.db.models.group_settings import GroupSettings
from app.utils.security import hash_password


def ensure_super_admin(db: Session):
    # 1. Check if any user is in the "SUPER_ADMIN" group
    super_admin_group = db.query(Group).filter(Group.name == "SUPER_ADMIN").first()
    if not super_admin_group:
        # Create the super admin group with permissive settings
        super_admin_group = Group(name="SUPER_ADMIN")
        super_admin_group.settings = GroupSettings(
            allowed_extensions=["jpg","png","gif","zip","pdf"],  # unlimited if you prefer
            max_file_size=None  # or huge number
        )
        db.add(super_admin_group)
        db.commit()
        db.refresh(super_admin_group)

    # 2. Check if there's any user in that group
    existing_superadmin_user = (
        db.query(User)
        .filter(User.group_id == super_admin_group.id)
        .first()
    )
    if not existing_superadmin_user:
        # Prompt for username/password or set defaults
        username = "admin"  # or ask input
        hashed_password = hash_password("admin")  # obviously do real hashing
        new_user = User(
            username=username,
            hashed_password=hashed_password,
            group_id=super_admin_group.id
        )
        db.add(new_user)
        db.commit()
        print("Created super admin user:", username)

