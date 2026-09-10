"""Database session and engine management (async-only for application runtime).

All modules share one async engine (asyncmy) and one ``async_sessionmaker``.
Synchronous CLI scripts (scripts/init_db.py, scripts/seed_profile_rules.py)
create their own pymysql engine via ``settings.sync_database_url``.
"""

from collections.abc import AsyncGenerator
import importlib.util
import sys

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _get_async_database_url() -> str:
    url = settings.database_url
    if url.startswith("sqlite"):
        # 开发/测试用 SQLite 时切到 aiosqlite 异步驱动
        if importlib.util.find_spec("aiosqlite") is not None:
            return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return url
    if url.startswith("mysql+pymysql://"):
        url = url.replace("mysql+pymysql://", "mysql+asyncmy://", 1)
    if importlib.util.find_spec("asyncmy") is not None:
        return url
    if importlib.util.find_spec("aiomysql") is not None:
        return url.replace("mysql+asyncmy://", "mysql+aiomysql://", 1)
    return url


def _engine_kwargs() -> dict:
    # pytest 下每个用例一个事件循环，池化连接跨 loop 复用会报
    # "attached to a different loop"，因此测试环境禁用连接池。
    if "pytest" in sys.modules:
        return {"poolclass": NullPool}
    return {
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 3600,
    }


async_engine = create_async_engine(
    _get_async_database_url(),
    echo=settings.is_debug,
    **_engine_kwargs(),
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
