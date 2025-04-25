from fastapi import APIRouter

from .account import router as account_router
from .sessions import router as sessions_router
from .settings_utils import router as settings_utils_router

router = APIRouter()

# Include each mini-router. We do NOT set a prefix here,
# because we want to preserve the existing endpoints:
# e.g. /auth/login, /auth/logout, etc.
router.include_router(account_router)
router.include_router(sessions_router)
router.include_router(settings_utils_router)
