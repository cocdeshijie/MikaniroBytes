from fastapi import APIRouter

from .upload import router as upload_router
from .download import router as download_router
from .management import router as management_router

router = APIRouter()

# Combine everything under /files
router.include_router(upload_router)
router.include_router(download_router)
router.include_router(management_router)
