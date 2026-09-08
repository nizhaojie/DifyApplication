"""FastAPI dependency injection utilities."""

from typing import Generator
from fastapi import Depends
from sqlalchemy.orm import Session
from app.db.session import get_database_session


def get_db() -> Generator[Session, None, None]:
    """Dependency provider for database sessions in FastAPI endpoints."""
    yield from get_database_session()
