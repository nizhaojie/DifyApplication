"""FastAPI dependency injection utilities."""

from collections.abc import AsyncGenerator

from fastapi import Depends, Header, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BizError
from app.core.security import decode_token
from app.db.session import AsyncSessionLocal, get_db
from app.integrations.dify import DifyWorkflowInsightAdapter
from app.modules.report.application import (
    KIND_COMPLAINT_WEEKLY,
    KIND_CUSTOMER_OPS,
    KIND_DAILY_SUMMARY,
    KIND_PSYCH_WEEKLY,
    KIND_WEEKLY_SUMMARY,
    ReportApplication,
)
from app.modules.report.clock import ShanghaiClock
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


async def get_report_app() -> AsyncGenerator[ReportApplication, None]:
    """Yield a ReportApplication bound to an async session with commit-on-success."""
    async with AsyncSessionLocal() as session:
        try:
            yield ReportApplication(
                db=session,
                clock=ShanghaiClock(),
                insight=DifyWorkflowInsightAdapter(
                    base_url=settings.dify_api_base,
                    api_keys={
                        KIND_CUSTOMER_OPS: settings.dify_customer_ops_api_key,
                        KIND_COMPLAINT_WEEKLY: settings.dify_complaint_weekly_api_key,
                        KIND_DAILY_SUMMARY: settings.dify_daily_summary_api_key,
                        KIND_WEEKLY_SUMMARY: settings.dify_daily_summary_api_key,
                        KIND_PSYCH_WEEKLY: settings.dify_psych_weekly_api_key,
                    },
                    timeout=settings.dify_timeout_seconds,
                ),
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
