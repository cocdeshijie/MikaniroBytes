from fastapi import FastAPI
from sqlalchemy.orm import Session
from app.db.database import engine, SessionLocal
from app.db.base_class import Base
from app.db.models import *
from app.utils.init_super_admin import ensure_super_admin
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run on startup
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_super_admin(db)

    yield  # Hand control over to the app

    # Run on shutdown (optional cleanup)


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    @app.get("/ping")
    async def ping():
        """
        A simple health check or 'ping' endpoint.
        """
        return {"message": "pong"}

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
