from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BizError
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.system.models.user import SysRole, SysUser
from app.modules.auth.schemas.account import ChangePasswordIn, RegisterIn, UpdateMeIn
from app.utils.serialize import row_to_dict

STUDENT_ROLE_CODE = "student"


async def load_role(db: AsyncSession, role_id: int | None) -> SysRole | None:
    if role_id is None:
        return None
    return await db.get(SysRole, role_id)


def public_user(user: SysUser, role: SysRole | None = None) -> dict:
    data = row_to_dict(user)
    data.pop("password_hash", None)
    data["role_code"] = role.role_code if role else None
    data["role_name"] = role.role_name if role else None
    return data


async def login(db: AsyncSession, username: str, password: str) -> dict:
    user = (
        await db.execute(select(SysUser).where(SysUser.username == username.strip()))
    ).scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise BizError("账号或密码不对")
    if user.status != "normal":
        raise BizError("账号已停用")
    token = create_access_token(int(user.id), user.username)
    role = await load_role(db, user.role_id)
    return {"token": token, "user": public_user(user, role)}


async def register(db: AsyncSession, payload: RegisterIn) -> dict:
    username = payload.username.strip()
    exists = (
        await db.execute(select(SysUser).where(SysUser.username == username))
    ).scalar_one_or_none()
    if exists is not None:
        raise BizError("用户名已被占用，请换一个")
    role = (
        await db.execute(select(SysRole).where(SysRole.role_code == STUDENT_ROLE_CODE))
    ).scalar_one_or_none()
    user = SysUser(
        username=username,
        password_hash=hash_password(payload.password),
        real_name=payload.real_name.strip(),
        user_type=STUDENT_ROLE_CODE,
        role_id=role.id if role else None,
        contact_info=payload.contact_info,
        status="normal",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(int(user.id), user.username)
    return {"token": token, "user": public_user(user, role)}


async def update_profile(db: AsyncSession, user: SysUser, payload: UpdateMeIn) -> dict:
    if payload.real_name is not None:
        user.real_name = payload.real_name.strip()
    if payload.department is not None:
        user.department = payload.department.strip() or None
    if payload.contact_info is not None:
        user.contact_info = payload.contact_info.strip() or None
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url.strip() or None
    await db.commit()
    await db.refresh(user)
    role = await load_role(db, user.role_id)
    return public_user(user, role)


async def change_password(db: AsyncSession, user: SysUser, payload: ChangePasswordIn) -> None:
    if not verify_password(payload.old_password, user.password_hash):
        raise BizError("原密码不正确")
    if payload.old_password == payload.new_password:
        raise BizError("新密码不能与原密码相同")
    user.password_hash = hash_password(payload.new_password)
    await db.commit()
