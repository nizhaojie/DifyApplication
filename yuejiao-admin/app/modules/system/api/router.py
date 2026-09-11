from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.core.response import ok
from app.modules.system.models.user import SysUser
from app.modules.system.schemas.admin import (
    RoleCreate,
    RoleUpdate,
    UserCreate,
    UserResetPassword,
    UserUpdate,
)
from app.modules.system.services import admin_service

# 整组接口仅 admin 角色可达；前端面板只是这层守卫的可视化。
router = APIRouter(
    prefix="/system",
    tags=["系统管理"],
    dependencies=[Depends(require_role("admin"))],
)


@router.get("/users")
async def list_users(
    keyword: str | None = Query(default=None, max_length=64),
    user_type: str | None = Query(default=None, pattern="^(student|employee|admin)$"),
    status: str | None = Query(default=None, pattern="^(normal|disabled)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    items, total = await admin_service.list_users(
        db, keyword=keyword, user_type=user_type, status=status, limit=limit, offset=offset
    )
    return ok(items, total=total)


@router.post("/users")
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    data = await admin_service.create_user(db, body)
    return ok(data, message="账号已创建")


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    body: UserUpdate,
    actor: SysUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_service.update_user(db, actor, user_id, body)
    return ok(data, message="账号已更新")


@router.put("/users/{user_id}/password")
async def reset_password(user_id: int, body: UserResetPassword, db: AsyncSession = Depends(get_db)):
    await admin_service.reset_password(db, user_id, body.new_password)
    return ok(message="密码已重置")


@router.get("/roles")
async def list_roles(db: AsyncSession = Depends(get_db)):
    return ok(await admin_service.list_roles(db))


@router.post("/roles")
async def create_role(body: RoleCreate, db: AsyncSession = Depends(get_db)):
    data = await admin_service.create_role(db, body)
    return ok(data, message="角色已创建")


@router.put("/roles/{role_id}")
async def update_role(role_id: int, body: RoleUpdate, db: AsyncSession = Depends(get_db)):
    data = await admin_service.update_role(db, role_id, body)
    return ok(data, message="角色已更新")


@router.delete("/roles/{role_id}")
async def delete_role(role_id: int, db: AsyncSession = Depends(get_db)):
    await admin_service.delete_role(db, role_id)
    return ok(message="角色已删除")
