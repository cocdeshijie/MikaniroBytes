# database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 1) Check which DB engine we want
DB_ENGINE = os.environ.get("DB_ENGINE", "sqlite")

if DB_ENGINE == "mysql":
    # 2) Gather MySQL parameters from env
    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_PORT = os.environ.get("DB_PORT", "3306")
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASS = os.environ.get("DB_PASS", "secret")
    DB_NAME = os.environ.get("DB_NAME", "mikanirobytes")

    # 3) Construct SQLAlchemy connection URL
    #    Make sure you install a MySQL driver like "PyMySQL"
    #    e.g. pip install pymysql
    SQLALCHEMY_DATABASE_URL = (
        f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
else:
    # 4) Default to SQLite (local dev)
    SQLALCHEMY_DATABASE_URL = "sqlite:///./MikaniroBytes.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # For SQLite, need connect_args check_same_thread
    connect_args={"check_same_thread": False} if DB_ENGINE == "sqlite" else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Dependency helper to provide a DB session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
