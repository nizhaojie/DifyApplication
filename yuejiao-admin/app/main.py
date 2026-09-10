"""Main FastAPI application entrypoint."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import BizError
from app.core.response import fail, ok
from app.db.session import AsyncSessionLocal
from app.modules.cs.services.event.event_service import event_service
from app.modules.cs.services.rag.kb_engine import kb_engine
from app.modules.cs.services.recommend.course_matcher import course_matcher
from app.modules.enterprise.models import *  # noqa: F401,F403
from app.modules.profile.models import *  # noqa: F401,F403
from app.modules.report.models import ReportGeneration  # noqa: F401
from app.modules.student.models import *  # noqa: F401,F403
from app.modules.system.models import *  # noqa: F401,F403

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context: seed necessary initial records on startup."""
    logger.info("Starting up %s...", settings.app_name)
    async with AsyncSessionLocal() as db:
        try:
            # 1. Seed courses
            course_count = await course_matcher.ensure_seed_courses(db)
            logger.info("Seed courses verified/inserted: %d", course_count)

            # 2. Seed events
            event_count = await event_service.ensure_seed_events(db)
            logger.info("Seed events verified/inserted: %d", event_count)

            # 3. Seed knowledge base chunks from local materials if available
            raw_materials_dir = settings.kb_raw_materials_dir
            if raw_materials_dir and os.path.isdir(raw_materials_dir):
                kb_count = await kb_engine.seed_from_local_materials(db, raw_materials_dir)
                logger.info("Knowledge base chunks verified/inserted: %d", kb_count)
            else:
                logger.warning(
                    "知识库原始素材未配置或不存在（KB_RAW_MATERIALS_DIR=%r），"
                    "客服知识库 /faq 知识库将保持为空；"
                    "请在 .env 中配置 KB_RAW_MATERIALS_DIR 指向包含 "
                    "公司信息/公司业务/留学政策 子目录的素材文件夹。",
                    raw_materials_dir,
                )
        except Exception as exc:
            logger.warning("Startup database seeding skipped or encountered error: %s", exc)
    yield
    logger.info("Shutting down %s...", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="粤教教育服务智能化管理后台：客服Agent、企业智能助手与智能报告。",
    debug=settings.is_debug,
    lifespan=lifespan,
)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BizError)
async def biz_error_handler(_: Request, exc: BizError) -> JSONResponse:
    return JSONResponse(fail(exc.message, code=exc.code))


@app.get("/health", summary="Health Check")
async def health_check():
    """Health check ping endpoint."""
    return ok({"status": "healthy", "app": settings.app_name})


@app.get("/api/v1/health")
async def api_health():
    return ok({"status": "ok"})


@app.get("/", summary="Root Index")
async def root_index():
    """Root metadata endpoint."""
    return ok(
        {
            "app": settings.app_name,
            "docs_url": "/docs",
            "api_v1": settings.api_v1_prefix,
        }
    )


# Mount API V1 router
app.include_router(api_router, prefix=settings.api_v1_prefix)
