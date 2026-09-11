from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.response import ok
from app.modules.auth.schemas.account import ChangePasswordIn, RegisterIn, UpdateMeIn
from app.modules.auth.schemas.login import LoginIn
from app.modules.auth.services import auth_service
from app.modules.system.models.user import SysUser

router = APIRouter(prefix="/auth", tags=["登录"])


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    data = await auth_service.login(db, body.username, body.password)
    return ok(data, message="登录成功")


@router.post("/register")
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    """开放注册：默认创建学生角色账号并直接登录。"""
    data = await auth_service.register(db, body)
    return ok(data, message="注册成功")


@router.get("/me")
async def me(user: SysUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = await auth_service.load_role(db, user.role_id)
    return ok(auth_service.public_user(user, role))


@router.put("/me")
async def update_me(
    body: UpdateMeIn,
    user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await auth_service.update_profile(db, user, body)
    return ok(data, message="资料已更新")


@router.put("/password")
async def change_password(
    body: ChangePasswordIn,
    user: SysUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.change_password(db, user, body)
    return ok(message="密码已修改，下次登录请使用新密码")
