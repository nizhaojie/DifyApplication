"""Main FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import api_v1_router
from app.core.config import settings
from app.core.response import make_success_response
from app.db.session import SessionLocal
from app.modules.cs.services.event.event_service import event_service
from app.modules.cs.services.rag.kb_engine import kb_engine
from app.modules.cs.services.recommend.course_matcher import course_matcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context: seed necessary initial records on startup."""
    logger.info("Starting up %s...", settings.app_name)
    db = SessionLocal()
    try:
        # 1. Seed courses
        course_count = course_matcher.ensure_seed_courses(db)
        logger.info("Seed courses verified/inserted: %d", course_count)

        # 2. Seed events
        event_count = event_service.ensure_seed_events(db)
        logger.info("Seed events verified/inserted: %d", event_count)

        # 3. Seed knowledge base chunks from local materials if available
        import os
        raw_materials_dir = r"c:\new\group-qukewei\docs\raw_materials"
        if os.path.exists(raw_materials_dir):
            kb_count = kb_engine.seed_from_local_materials(db, raw_materials_dir)
            logger.info("Knowledge base chunks verified/inserted: %d", kb_count)
    except Exception as exc:
        logger.warning("Startup database seeding skipped or encountered error: %s", exc)
    finally:
        db.close()
    yield
    logger.info("Shutting down %s...", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    debug=settings.is_debug,
    lifespan=lifespan,
)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API V1 routers
app.include_router(api_v1_router, prefix=settings.api_v1_prefix)


@app.get("/health", summary="Health Check")
def health_check():
    """Health check ping endpoint."""
    return make_success_response(payload={"status": "healthy", "app": settings.app_name})


@app.get("/", summary="Root Index")
def root_index():
    """Root metadata endpoint."""
    return make_success_response(
        payload={
            "app": settings.app_name,
            "docs_url": "/docs",
            "api_v1": settings.api_v1_prefix,
        }
    )
