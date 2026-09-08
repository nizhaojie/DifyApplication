"""Database session and engine management."""

from collections.abc import AsyncGenerator
from typing import Generator
import pymysql
from pymysql.cursors import DictCursor
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# Synchronous engine and session for Customer Service module and scripts
engine = create_engine(
    settings.sync_database_url,
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


def get_sync_db() -> Generator[Session, None, None]:
    """Dependency provider for synchronous database sessions."""
    yield from get_database_session()


def _get_async_database_url() -> str:
    import importlib.util

    url = settings.database_url
    if importlib.util.find_spec("asyncmy") is not None:
        return url
    if importlib.util.find_spec("aiomysql") is not None:
        return url.replace("mysql+asyncmy://", "mysql+aiomysql://", 1)
    return url


# Asynchronous engine and session for Enterprise and Auth modules
async_engine = create_async_engine(
    _get_async_database_url(),
    pool_pre_ping=True,
    echo=settings.debug,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency provider for asynchronous database sessions."""
    async with AsyncSessionLocal() as session:
        yield session


def open_connection():
    """Direct PyMySQL connection for Report module."""
    return pymysql.connect(
        host=settings.mysql_host,
        port=settings.mysql_port,
        user=settings.mysql_user,
        password=settings.mysql_password,
        database=settings.mysql_database,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
    )
