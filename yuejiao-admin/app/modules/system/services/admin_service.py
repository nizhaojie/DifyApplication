"""系统管理服务：用户 CRUD 与角色字典维护（仅 admin 角色可达，守卫在 router 层）。"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BizError
from app.core.security import hash_password
from app.modules.system.models.user import SysRole, SysUser
from app.modules.system.schemas.admin import (
    RoleCreate,
    RoleUpdate,
    UserCreate,
    UserResetPassword,
    UserUpdate,
)
from app.utils.serialize import row_to_dict

ADMIN_ROLE_CODE = "admin"
STUDENT_ROLE_CODE = "student"

# user_type 驱动报表等业务查询（u.user_type = 'student'），创建账号时按角色推导。
_ROLE_TO_USER_TYPE = {
    ADMIN_ROLE_CODE: "admin",
    STUDENT_ROLE_CODE: "student",
}


def _user_type_for(role: SysRole) -> str:
    return _ROLE_TO_USER_TYPE.get(role.role_code, "employee")


def user_public(user: SysUser, role: SysRole | None = None) -> dict:
    data = row_to_dict(user)
    data.pop("password_hash", None)
    data["role_code"] = role.role_code if role else None
    data["role_name"] = role.role_name if role else None
    return data


async def _require_role(db: AsyncSession, role_id: int) -> SysRole:
    role = await db.get(SysRole, role_id)
    if role is None:
        raise BizError("角色不存在")
    return role


async def list_users(
    db: AsyncSession,
    *,
    keyword: str | None = None,
    user_type: str | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict], int]:
    query = select(SysUser, SysRole).outerjoin(SysRole, SysUser.role_id == SysRole.id)
    count_query = select(func.count()).select_from(SysUser)
    if keyword:
        like = f"%{keyword.strip()}%"
        cond = SysUser.username.like(like) | SysUser.real_name.like(like)
        query = query.where(cond)
        count_query = count_query.where(cond)
    if user_type:
        query = query.where(SysUser.user_type == user_type)
        count_query = count_query.where(SysUser.user_type == user_type)
    if status:
        query = query.where(SysUser.status == status)
        count_query = count_query.where(SysUser.status == status)

    total = (await db.execute(count_query)).scalar_one()
    rows = (
        await db.execute(query.order_by(SysUser.id.asc()).limit(limit).offset(offset))
    ).all()
    items = [user_public(user, role) for user, role in rows]
    return items, total


async def create_user(db: AsyncSession, payload: UserCreate) -> dict:
    username = payload.username.strip()
    exists = (
        await db.execute(select(SysUser).where(SysUser.username == username))
    ).scalar_one_or_none()
    if exists is not None:
        raise BizError("用户名已被占用")
    role = await _require_role(db, payload.role_id)
    user = SysUser(
        username=username,
        password_hash=hash_password(payload.password),
        real_name=payload.real_name.strip(),
        user_type=_user_type_for(role),
        role_id=role.id,
        department=payload.department,
        contact_info=payload.contact_info,
        status="normal",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user_public(user, role)


async def update_user(db: AsyncSession, actor: SysUser, user_id: int, payload: UserUpdate) -> dict:
    user = await db.get(SysUser, user_id)
    if user is None:
        raise BizError("用户不存在", code=404)
    if payload.real_name is not None:
        user.real_name = payload.real_name.strip()
    if payload.department is not None:
        user.department = payload.department.strip() or None
    if payload.contact_info is not None:
        user.contact_info = payload.contact_info.strip() or None
    if payload.role_id is not None and payload.role_id != user.role_id:
        if user.id == actor.id:
            raise BizError("不能变更自己的角色")
        role = await _require_role(db, payload.role_id)
        user.role_id = role.id
        user.user_type = _user_type_for(role)
    if payload.status is not None and payload.status != user.status:
        if user.id == actor.id:
            raise BizError("不能停用自己的账号")
        user.status = payload.status
    await db.commit()
    await db.refresh(user)
    role = await db.get(SysRole, user.role_id) if user.role_id else None
    return user_public(user, role)


async def reset_password(db: AsyncSession, user_id: int, new_password: str) -> None:
    user = await db.get(SysUser, user_id)
    if user is None:
        raise BizError("用户不存在", code=404)
    user.password_hash = hash_password(new_password)
    await db.commit()


async def list_roles(db: AsyncSession) -> list[dict]:
    rows = (
        await db.execute(
            select(SysRole, func.count(SysUser.id))
            .outerjoin(SysUser, SysUser.role_id == SysRole.id)
            .group_by(SysRole.id)
            .order_by(SysRole.id.asc())
        )
    ).all()
    items = []
    for role, user_count in rows:
        data = row_to_dict(role)
        data["user_count"] = user_count
        items.append(data)
    return items


async def create_role(db: AsyncSession, payload: RoleCreate) -> dict:
    exists = (
        await db.execute(select(SysRole).where(SysRole.role_code == payload.role_code))
    ).scalar_one_or_none()
    if exists is not None:
        raise BizError("角色编码已存在")
    role = SysRole(
        role_code=payload.role_code,
        role_name=payload.role_name.strip(),
        description=payload.description,
        status=1,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    data = row_to_dict(role)
    data["user_count"] = 0
    return data


async def update_role(db: AsyncSession, role_id: int, payload: RoleUpdate) -> dict:
    role = await db.get(SysRole, role_id)
    if role is None:
        raise BizError("角色不存在", code=404)
    if payload.role_name is not None:
        role.role_name = payload.role_name.strip()
    if payload.description is not None:
        role.description = payload.description
    if payload.status is not None and payload.status != role.status:
        if role.role_code == ADMIN_ROLE_CODE and payload.status != 1:
            raise BizError("不能停用系统管理员角色")
        role.status = payload.status
    await db.commit()
    await db.refresh(role)
    return row_to_dict(role)


async def delete_role(db: AsyncSession, role_id: int) -> None:
    role = await db.get(SysRole, role_id)
    if role is None:
        raise BizError("角色不存在", code=404)
    if role.role_code == ADMIN_ROLE_CODE:
        raise BizError("系统管理员角色不允许删除")
    in_use = (
        await db.execute(select(func.count()).select_from(SysUser).where(SysUser.role_id == role_id))
    ).scalar_one()
    if in_use:
        raise BizError(f"仍有 {in_use} 个账号使用该角色，请先调整后再删除")
    await db.delete(role)
    await db.commit()
