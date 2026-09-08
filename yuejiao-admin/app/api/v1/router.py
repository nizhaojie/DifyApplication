from fastapi import APIRouter

from app.modules.report.api import router as report_router

api_router = APIRouter()
api_router.include_router(report_router, prefix="/reports", tags=["reports"])
