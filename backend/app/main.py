import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.db.database import engine, SessionLocal
from app.db.base_class import Base
from app.db.models import *
from app.utils.init_db import init_db

# Routers
from app.routers import auth
from app.routers import files
from app.routers import admin

UPLOAD_DIR = "uploads"


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
        StaticFiles(directory=UPLOAD_DIR, check_dir=False),  # check_dir False as extra safety
        name="uploads",
    )

    # ------------------------------------------------------------------ #
    # Routers                                                            #
    # ------------------------------------------------------------------ #
    app.include_router(auth.router,  prefix="/auth",  tags=["auth"])
    app.include_router(files.router, prefix="/files", tags=["files"])
    app.include_router(admin.router, prefix="/admin", tags=["admin"])

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)