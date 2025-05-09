from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session
import uuid

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.system_settings import SystemSettings
from app.db.models.user_session import UserSession
from app.utils.security import verify_password, hash_password
from app.dependencies.auth import get_current_user

router = APIRouter()


# ────────────────────────────────────────────────────────────────────
#  Pydantic DTOs
# ────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class LogoutRequest(BaseModel):
    token: str


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr | None = None
    password: str

    # Accept an empty string ("") and convert it to None so FastAPI
    # won’t raise a 422 error when the field is left blank.
    @field_validator("email", mode="before")
    @classmethod
    def _empty_to_none(cls, v):
        if v in ("", None):
            return None
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ChangeUsernameRequest(BaseModel):
    new_username: str


# ────────────────────────────────────────────────────────────────────
#  Auth routes (login, logout, register, user info, etc.)
# ────────────────────────────────────────────────────────────────────
@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Basic login with username and password.
    Stores session token plus device/browser info in user_sessions table.
    """
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=400, detail="Invalid username or password.")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password.")

    # Generate a unique token
    session_token = str(uuid.uuid4())

    # Read user agent + IP
    user_agent = request.headers.get("User-Agent", "Unknown Agent")
    client_ip = request.client.host if request.client else None

    device_info = user_agent[:120]  # store first 120 chars to avoid oversize

    new_session = UserSession(
        user_id=user.id,
        token=session_token,
        ip_address=client_ip,
        client_name=device_info,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return {
        "access_token": session_token,
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    """
    Logout by deleting the session corresponding to the given token.
    """
    session = db.query(UserSession).filter_by(token=payload.token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    db.delete(session)
    db.commit()
    return {"detail": "Logged out."}


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user account.
    - If SystemSettings.registration_enabled == False, block it
    - If default_user_group_id is set, use that group for new user
    - Otherwise fallback to "FREE_USER" or "USERS" or some other logic
    """

    # 1) Check system settings
    system_settings = db.query(SystemSettings).first()
    if system_settings and not system_settings.registration_enabled:
        raise HTTPException(status_code=403, detail="Registration is disabled.")

    # 2) Check if username already exists
    existing_user = db.query(User).filter(User.username == payload.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken.")

    # 3) Optional: check if email is used (only when user provided one)
    if payload.email:
        email_in_use = db.query(User).filter(User.email == payload.email).first()
        if email_in_use:
            raise HTTPException(status_code=400, detail="Email already in use.")

    # 4) Figure out which group to put them in
    group_id = None
    if system_settings and system_settings.default_user_group_id:
        default_group = (
            db.query(User.group.property.mapper.class_)
            .filter_by(id=system_settings.default_user_group_id)
            .first()
        )
        if default_group:
            group_id = default_group.id
    else:
        fallback_group = (
            db.query(User.group.property.mapper.class_).filter_by(name="USERS").first()
        )
        if fallback_group:
            group_id = fallback_group.id

    # 5) Create the user
    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        group_id=group_id,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"detail": "User registered successfully", "username": new_user.username}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """
    Return basic user info (e.g. username, email).
    """
    group_data = None
    if current_user.group:
        group_data = {
            "id": current_user.group.id,
            "name": current_user.group.name,
        }
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "group": group_data,
    }


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Change the current user's password, requiring old_password match.
    """
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password.")

    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {"detail": "Password changed successfully"}


# ────────────────────────────────────────────────────────────────────
#  Change username
# ────────────────────────────────────────────────────────────────────
@router.post("/change-username")
def change_username(
    payload: ChangeUsernameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Let an authenticated user pick a new username (must be unique).
    """
    new_username = payload.new_username.strip()

    if not new_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty.")
    if new_username == current_user.username:
        raise HTTPException(status_code=400, detail="That is already your username.")

    RESERVED = {"guest", "admin"}
    if new_username.lower() in RESERVED:
        raise HTTPException(status_code=400, detail="This username is reserved.")

    dup = db.query(User).filter(User.username == new_username).first()
    if dup:
        raise HTTPException(status_code=400, detail="Username already taken.")

    current_user.username = new_username
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {
        "detail": "Username changed successfully",
        "username": current_user.username,
    }
