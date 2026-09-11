from fastapi import APIRouter

from app.modules.auth.api.router import router as auth_router
from app.modules.cs.api.v1.router import router as cs_router
from app.modules.enterprise.api.router import router as enterprise_router
from app.modules.profile.api.router import router as profile_router
from app.modules.report.api import router as report_router
from app.modules.student.api.router import router as student_router
from app.modules.system.api.router import router as system_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(enterprise_router)
api_router.include_router(report_router, prefix="/reports", tags=["reports"])
api_router.include_router(profile_router)
api_router.include_router(cs_router)
api_router.include_router(student_router)
api_router.include_router(system_router)
