from fastapi import APIRouter

from .groups import router as groups_router
from .users import router as users_router
from .system import router as system_router

router = APIRouter()

# Include each mini-router in the parent router for /admin.
router.include_router(groups_router)
router.include_router(users_router)
router.include_router(system_router)
