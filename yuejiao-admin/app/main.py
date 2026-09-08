from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import BizError
from app.core.response import fail, ok
from app.modules.enterprise.models import *  # noqa: F401,F403
from app.modules.student.models import *  # noqa: F401,F403
from app.modules.system.models import *  # noqa: F401,F403

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="粤教企业智能助手：Dify 想、FastAPI 做、MySQL 记。",
)

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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "yuejiao-enterprise"}


@app.get("/api/v1/health")
async def api_health():
    return ok({"status": "ok"})


app.include_router(api_router, prefix="/api/v1")
