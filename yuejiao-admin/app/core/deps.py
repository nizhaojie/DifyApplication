from fastapi import Depends, Header, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BizError
from app.core.security import decode_token
from app.db.session import get_db
from app.modules.system.models.user import SysUser

bearer = HTTPBearer(auto_error=False)


async def load_user(db: AsyncSession, user_id: int) -> SysUser:
    user = await db.get(SysUser, user_id)
    if user is None or user.status != "normal":
        raise BizError("用户不存在或已停用", code=401)
    return user


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> SysUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise BizError("请先登录", code=401)
    try:
        payload = decode_token(creds.credentials)
        user_id = int(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError):
        raise BizError("登录已过期，请重新登录", code=401)
    return await load_user(db, user_id)


async def get_actor(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    x_dify_token: str | None = Header(default=None, alias="X-Dify-Token"),
    employee_id: int | None = Query(default=None),
    x_employee_id: int | None = Header(default=None, alias="X-Employee-Id"),
) -> SysUser:
    if creds is not None and creds.scheme.lower() == "bearer":
        try:
            payload = decode_token(creds.credentials)
            return await load_user(db, int(payload["sub"]))
        except (InvalidTokenError, KeyError, ValueError, BizError):
            pass

    token_ok = bool(settings.dify_tool_token) and x_dify_token == settings.dify_tool_token
    allow_open = settings.debug and not settings.dify_tool_token
    if not token_ok and not allow_open:
        raise BizError("请先登录", code=401)

    target_id = employee_id or x_employee_id
    if target_id:
        return await load_user(db, target_id)

    result = await db.execute(
        select(SysUser).where(SysUser.username == "emp01", SysUser.status == "normal")
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise BizError("未找到演示员工 emp01，请先执行 seed_enterprise_demo.sql", code=401)
    return user
