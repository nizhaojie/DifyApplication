from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.response import ok
from app.modules.auth.schemas.login import LoginIn
from app.modules.auth.services import auth_service
from app.modules.system.models.user import SysUser

router = APIRouter(prefix="/auth", tags=["登录"])


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    data = await auth_service.login(db, body.username, body.password)
    return ok(data, message="登录成功")


@router.get("/me")
async def me(user: SysUser = Depends(get_current_user)):
    return ok(auth_service.public_user(user))
