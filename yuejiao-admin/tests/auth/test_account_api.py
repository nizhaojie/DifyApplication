"""注册 / 资料修改 / 改密码 接口回归：开放注册默认学生角色，密码用 bcrypt 落库。"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db.session import AsyncSessionLocal
from app.main import app
from app.modules.system.models.user import SysRole, SysUser


@pytest.fixture(scope="module")
def api_client():
    with TestClient(app) as client:
        yield client


async def _ensure_role(code: str, name: str) -> None:
    """种子角色缺失时补建（开发库正常已有；保留不清理，属合法种子数据）。"""
    session = AsyncSessionLocal()
    try:
        exists = (
            await session.execute(select(SysRole).where(SysRole.role_code == code))
        ).scalar_one_or_none()
        if exists is None:
            session.add(SysRole(role_code=code, role_name=name, status=1))
            await session.commit()
    finally:
        await session.close()


async def _drop_user(username: str) -> None:
    session = AsyncSessionLocal()
    try:
        await session.execute(delete(SysUser).where(SysUser.username == username))
        await session.commit()
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_register_login_profile_password(api_client):
    suffix = uuid.uuid4().hex[:8]
    username = f"reg_t_{suffix}"
    await _ensure_role("student", "学生")

    resp = api_client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "password": "secret66",
            "real_name": "注册同学",
            "contact_info": "reg@test.dev",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200, body
    user = body["data"]["user"]
    assert user["username"] == username
    assert user["user_type"] == "student"
    assert user["role_code"] in (None, "student")
    assert "password_hash" not in user
    token = body["data"]["token"]

    try:
        # 重复注册被拒
        dup = api_client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "secret66", "real_name": "重复"},
        )
        assert dup.json()["code"] != 200

        # 新账号可直接登录
        login = api_client.post("/api/v1/auth/login", json={"username": username, "password": "secret66"})
        assert login.json()["code"] == 200, login.json()

        # 资料更新后回读，role_code 随用户返回
        me = api_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.json()["data"]["role_code"] in (None, "student")
        upd = api_client.put(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"real_name": "改名同学", "contact_info": "new@test.dev"},
        )
        assert upd.json()["code"] == 200, upd.json()
        assert upd.json()["data"]["real_name"] == "改名同学"

        # 改密码：原密码错被拒；改对后旧密码失效、新密码可登录
        headers = {"Authorization": f"Bearer {token}"}
        bad = api_client.put(
            "/api/v1/auth/password", headers=headers,
            json={"old_password": "wrong-old", "new_password": "fresh123"},
        )
        assert bad.json()["code"] != 200
        good = api_client.put(
            "/api/v1/auth/password", headers=headers,
            json={"old_password": "secret66", "new_password": "fresh123"},
        )
        assert good.json()["code"] == 200, good.json()
        old_login = api_client.post("/api/v1/auth/login", json={"username": username, "password": "secret66"})
        assert old_login.json()["code"] != 200
        new_login = api_client.post("/api/v1/auth/login", json={"username": username, "password": "fresh123"})
        assert new_login.json()["code"] == 200
    finally:
        await _drop_user(username)
