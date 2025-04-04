from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager

from app.db.database import engine, SessionLocal
from app.db.base_class import Base
from app.db.models import *
from app.utils.init_super_admin import ensure_super_admin

# Routers
from app.routers import auth
from app.routers import files
from app.routers import admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run on startup
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_super_admin(db)

    yield
    # shutdown logic if needed


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allows all origins
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods
        allow_headers=["*"],  # Allows all headers
    )

    @app.get("/ping")
    async def ping():
        """
        A simple health check or 'ping' endpoint.
        """
        return {"message": "pong"}

    # Mount the folder "uploads" so files can be served directly
    # e.g. http://localhost:8000/uploads/<hashedfilename.ext>
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    # Register routers
    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(files.router, prefix="/files", tags=["files"])
    app.include_router(admin.router, prefix="/admin", tags=["admin"])

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
