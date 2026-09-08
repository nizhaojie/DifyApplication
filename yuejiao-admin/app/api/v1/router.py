from fastapi import APIRouter

from app.modules.auth.api.router import router as auth_router
from app.modules.enterprise.api.router import router as enterprise_router
from app.modules.report.api import router as report_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(enterprise_router)
api_router.include_router(report_router, prefix="/reports", tags=["reports"])
