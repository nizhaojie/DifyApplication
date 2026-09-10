"""Database initialization script for Yuejiao Education Service Admin.

Executes database schema creation and pre-seeds initial courses, seminar events,
and knowledge base materials.

CLI scripts run synchronously (pymysql) — the application runtime itself is
async-only (see app/db/session.py).
"""

import asyncio
import os
import sys
import logging

# Ensure app root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession, create_async_engine

from app.core.config import settings
from app.db.base import Base
from app.db.session import _get_async_database_url
from app.modules.cs.models.models import (
    ChatMessage,
    ChatSession,
    CourseProject,
    EventLecture,
    EventRegistration,
    KnowledgeBase,
)

# 导入全部模块模型，确保 create_all 覆盖所有表（与 app/main.py 保持一致）
from app.modules import enterprise, profile, student, system  # noqa: F401
from app.modules.enterprise.models import *  # noqa: F401,F403
from app.modules.profile.models import *  # noqa: F401,F403
from app.modules.report.models import ReportGeneration  # noqa: F401
from app.modules.student.models import *  # noqa: F401,F403
from app.modules.system.models import *  # noqa: F401,F403

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("init_db")


def create_database_if_not_exists():
    """Ensure the target MySQL schema exists before binding tables."""
    logger.info("Verifying MySQL database existence for %s...", settings.db_name)
    # Parse server connection URL without database name
    server_url = (
        f"mysql+pymysql://{settings.db_user}:{settings.db_password}@"
        f"{settings.db_host}:{settings.db_port}/?charset={settings.db_charset}"
    )
    temp_engine = create_engine(server_url, pool_pre_ping=True)
    with temp_engine.connect() as conn:
        conn.execute(
            text(
                f"CREATE DATABASE IF NOT EXISTS `{settings.db_name}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
        )
        conn.commit()
    temp_engine.dispose()
    logger.info("Database `%s` is ready.", settings.db_name)


def init_database_tables():
    """Create all ORM defined tables in the database."""
    logger.info("Creating database tables via SQLAlchemy metadata...")
    engine = create_engine(settings.sync_database_url, pool_pre_ping=True)
    try:
        Base.metadata.create_all(bind=engine)
    finally:
        engine.dispose()
    logger.info("All tables created successfully.")


async def seed_database_records():
    """Seed initial courses, seminars, and RAG knowledge chunks (async, same as runtime)."""
    logger.info("Seeding initial domain data...")
    from app.modules.cs.services.event.event_service import event_service
    from app.modules.cs.services.rag.kb_engine import kb_engine
    from app.modules.cs.services.recommend.course_matcher import course_matcher

    engine = create_async_engine(_get_async_database_url(), pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_factory() as db:
            # 1. Seed courses
            courses_count = await course_matcher.ensure_seed_courses(db)
            logger.info("Course projects loaded/verified: %d", courses_count)

            # 2. Seed events
            events_count = await event_service.ensure_seed_events(db)
            logger.info("Seminar events loaded/verified: %d", events_count)

            # 3. Seed knowledge base
            materials_path = settings.kb_raw_materials_dir
            if materials_path and os.path.isdir(materials_path):
                kb_count = await kb_engine.seed_from_local_materials(db, materials_path)
                logger.info("Knowledge base chunks loaded/verified: %d", kb_count)
            else:
                logger.warning(
                    "Materials path %r not found (set KB_RAW_MATERIALS_DIR in .env), "
                    "skipped document seeding.",
                    materials_path,
                )
    finally:
        await engine.dispose()


def main():
    print("=" * 60)
    print("  Yuejiao Service CS Module - Database Initializer")
    print("=" * 60)
    try:
        create_database_if_not_exists()
        init_database_tables()
        asyncio.run(seed_database_records())
        print("\n[SUCCESS] Database initialization completed flawlessly!")
    except Exception as exc:
        logger.exception("Failed to initialize database: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
