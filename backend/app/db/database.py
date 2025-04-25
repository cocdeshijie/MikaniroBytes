from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# For now, using SQLite. You can switch to PostgreSQL, MySQL, etc. later.
SQLALCHEMY_DATABASE_URL = "sqlite:///./filebed.db"

# For SQLite, need connect_args={"check_same_thread": False}
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Dependency helper to provide a DB session.
    (You may later use this in your FastAPI endpoints.)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
