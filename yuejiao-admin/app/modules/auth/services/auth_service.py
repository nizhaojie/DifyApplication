from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BizError
from app.core.security import create_access_token, verify_password
from app.modules.system.models.user import SysUser
from app.utils.serialize import row_to_dict


def public_user(user: SysUser) -> dict:
    data = row_to_dict(user)
    data.pop("password_hash", None)
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
    return {"token": token, "user": public_user(user)}
