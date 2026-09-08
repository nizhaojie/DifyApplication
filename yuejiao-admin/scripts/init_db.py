"""Database initialization script for Yuejiao Education Service Admin.

Executes database schema creation and pre-seeds initial courses, seminar events,
and knowledge base materials.
"""

import os
import sys
import logging
from urllib.parse import urlparse

# Ensure app root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, text
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.modules.cs.models.models import (
    ChatMessage,
    ChatSession,
    CourseProject,
    EventLecture,
    EventRegistration,
    IntentConfig,
    KnowledgeBase,
)
from app.modules.cs.services.event.event_service import event_service
from app.modules.cs.services.rag.kb_engine import kb_engine
from app.modules.cs.services.recommend.course_matcher import course_matcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("init_db")


def create_database_if_not_exists():
    """Ensure the target MySQL schema exists before binding tables."""
    raw_url = settings.database_url
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
    Base.metadata.create_all(bind=engine)
    logger.info("All tables created successfully.")


def seed_database_records():
    """Seed initial courses, seminars, and RAG knowledge chunks."""
    logger.info("Seeding initial domain data...")
    db = SessionLocal()
    try:
        # 1. Seed courses
        courses_count = course_matcher.ensure_seed_courses(db)
        logger.info("Course projects loaded/verified: %d", courses_count)

        # 2. Seed events
        events_count = event_service.ensure_seed_events(db)
        logger.info("Seminar events loaded/verified: %d", events_count)

        # 3. Seed knowledge base
        materials_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "docs", "raw_materials")
        )
        if os.path.exists(materials_path):
            kb_count = kb_engine.seed_from_local_materials(db, materials_path)
            logger.info("Knowledge base chunks loaded/verified: %d", kb_count)
        else:
            logger.warning("Materials path %s not found, skipped document seeding.", materials_path)
    finally:
        db.close()


def main():
    print("=" * 60)
    print("  Yuejiao Service CS Module - Database Initializer")
    print("=" * 60)
    try:
        create_database_if_not_exists()
        init_database_tables()
        seed_database_records()
        print("\n[SUCCESS] Database initialization completed flawlessly!")
    except Exception as exc:
        logger.exception("Failed to initialize database: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
