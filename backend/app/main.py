import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from fastapi.staticfiles import StaticFiles

from app.db.database import engine, SessionLocal
from app.db.base_class import Base
from app.db.models import *
from app.utils.init_db import init_db

from app.routers.auth import router as auth_router
from app.routers.files import router as files_router
from app.routers.admin import router as admin_router

UPLOAD_DIR = "uploads"
PREVIEW_DIR = "previews"

uploads_app = StaticFiles(directory=UPLOAD_DIR, check_dir=False)


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
    # app.mount(
    #     "/",
    #     StaticFiles(directory=UPLOAD_DIR, check_dir=False),
    #     name="uploads",
    # )

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

    # ------------------------------------------------------------------ #
    # uploads                                                            #
    # ------------------------------------------------------------------ #
    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_uploads(request: Request, path: str) -> Response:
        """
        Pipe the request into the *uploads_app* exactly like a real mount,
        *but* only after all normal routes have failed, so API verbs work.
        """
        # Prevent path-traversal: resolved path must stay under UPLOAD_DIR
        abs_candidate = (Path(UPLOAD_DIR) / path).resolve()
        root_abs = Path(UPLOAD_DIR).resolve()

        if root_abs not in abs_candidate.parents and abs_candidate != root_abs:
            raise HTTPException(status_code=404)

        # Re-use StaticFiles' internal logic (ETag, If-Modified-Since, range…)
        response = await uploads_app.get_response(path, request.scope)
        if response.status_code == 404:
            # Let FastAPI’s default 404 handler create the body
            raise HTTPException(status_code=404)
        return response

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
