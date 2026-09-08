"""V1 API Router aggregation."""

from fastapi import APIRouter
from app.modules.cs.api.v1.router import router as cs_router

api_v1_router = APIRouter()
api_v1_router.include_router(cs_router)

__all__ = ["api_v1_router"]
