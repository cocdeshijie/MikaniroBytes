import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db.database import engine, SessionLocal
from app.db.base_class import Base
from app.db.models import *
from app.utils.init_db import init_db

# New subpackage routers
from app.routers.auth import router as auth_router
from app.routers.files import router as files_router
from app.routers.admin import router as admin_router

UPLOAD_DIR = "uploads"
PREVIEW_DIR = "previews"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup / shutdown handler.

    • Create tables.
    • Initialise default data (SUPER_ADMIN, GUEST,…).
    """
    Base.metadata.create_all(bind=engine)

    # run one‑time DB initialisation
    with SessionLocal() as db:
        init_db(db)

    # guarantee the static folder exists (prevents Starlette error)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)

    yield


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    # ------------------------------------------------------------------ #
    # CORS – allow everything while in development                       #
    # ------------------------------------------------------------------ #
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------ #
    # Health check                                                       #
    # ------------------------------------------------------------------ #
    @app.get("/ping")
    async def ping():
        return {"message": "pong"}

    # ------------------------------------------------------------------ #
    # Static file serving – /uploads/…                                   #
    # ------------------------------------------------------------------ #
    app.mount(
        "/uploads",
        StaticFiles(directory=UPLOAD_DIR, check_dir=False),
        name="uploads",
    )

    app.mount(
        "/previews",
        StaticFiles(directory=PREVIEW_DIR, check_dir=False),
        name="previews",
    )

    # ------------------------------------------------------------------ #
    # Routers                                                            #
    # ------------------------------------------------------------------ #
    app.include_router(auth_router,  prefix="/auth",  tags=["auth"])
    app.include_router(files_router, prefix="/files", tags=["files"])
    app.include_router(admin_router, prefix="/admin", tags=["admin"])

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
