from fastapi import APIRouter

from app.modules.auth.api.router import router as auth_router
from app.modules.enterprise.api.router import router as enterprise_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(enterprise_router)
