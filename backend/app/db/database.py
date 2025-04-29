import os
from sqlalchemy import create_engine, text, exc
from sqlalchemy.orm import sessionmaker

# 1) Check which DB engine we want
DB_ENGINE = os.environ.get("DB_ENGINE", "sqlite")

if DB_ENGINE == "mysql":
    # 2) Gather MySQL parameters from env
    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_PORT = os.environ.get("DB_PORT", "3306")
    DB_USER = os.environ.get("DB_USER", "mikanirobytes")
    DB_PASS = os.environ.get("DB_PASSWORD", "mikanirobytes")
    DB_NAME = os.environ.get("DB_NAME", "mikanirobytes")

    # 3) Construct SQLAlchemy connection URL
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


def check_db_initialized():
    """
    Check if database has already been initialized by testing for specific tables.
    Returns True if our application tables exist (not just any tables).
    """
    try:
        # Create a temporary session
        temp_session = SessionLocal()

        try:
            # Try to query specific tables we know should exist in our schema
            # This is more reliable than just checking if any tables exist
            if DB_ENGINE == "mysql":
                # Look for our specific table
                result = temp_session.execute(text("""
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = :db_name 
                    AND table_name IN ('users', 'groups', 'system_settings')
                """), {"db_name": DB_NAME})
                count = result.scalar()
                temp_session.close()
                return count >= 3  # We need at least these 3 tables
            else:
                # For SQLite
                result = temp_session.execute(text("""
                    SELECT COUNT(*) FROM sqlite_master 
                    WHERE type='table' 
                    AND name IN ('users', 'groups', 'system_settings')
                """))
                count = result.scalar()
                temp_session.close()
                return count >= 3  # We need at least these 3 tables
        except exc.SQLAlchemyError as e:
            # This likely means tables don't exist yet
            print(f"Error checking for tables: {e}")
            temp_session.close()
            return False

    except Exception as e:
        print(f"Error connecting to database: {e}")
        return False