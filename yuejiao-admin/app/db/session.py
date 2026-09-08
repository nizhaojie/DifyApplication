"""Database session and engine management."""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    echo=settings.is_debug,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_database_session() -> Generator[Session, None, None]:
    """Yield a database session and safely close upon completion."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
