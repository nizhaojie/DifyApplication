"""系统管理接口 RBAC 回归：非 admin 一律 403，用户/角色 CRUD 与自我保护规则。"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal
from app.main import app
from app.modules.system.models.user import SysRole, SysUser


@pytest.fixture(scope="module")
def api_client():
    with TestClient(app) as client:
        yield client


async def _ensure_role(code: str, name: str) -> SysRole:
    session = AsyncSessionLocal()
    try:
        role = (
            await session.execute(select(SysRole).where(SysRole.role_code == code))
        ).scalar_one_or_none()
        if role is None:
            role = SysRole(role_code=code, role_name=name, status=1)
            session.add(role)
            await session.commit()
            await session.refresh(role)
        return role
    finally:
        await session.close()


async def _drop_users(usernames: list[str]) -> None:
    session = AsyncSessionLocal()
    try:
        await session.execute(delete(SysUser).where(SysUser.username.in_(usernames)))
        await session.commit()
    finally:
        await session.close()


def _auth(user_id: int) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id, 't')}"}


@pytest.mark.asyncio
async def test_system_api_requires_admin_role(api_client):
    suffix = uuid.uuid4().hex[:8]
    admin_role = await _ensure_role("admin", "系统管理员")
    student_role = await _ensure_role("student", "学生")
    admin = SysUser(
        username=f"adm_t_{suffix}", password_hash="x", real_name="测试管理员",
        user_type="admin", role_id=admin_role.id, status="normal",
    )
    student = SysUser(
        username=f"stu_t_{suffix}", password_hash="x", real_name="测试学生",
        user_type="student", role_id=student_role.id, status="normal",
    )
    session = AsyncSessionLocal()
    try:
        session.add_all([admin, student])
        await session.commit()
        await session.refresh(admin)
        await session.refresh(student)
    finally:
        await session.close()

    try:
        # 未登录 → 401
        anon = api_client.get("/api/v1/system/users")
        assert anon.json()["code"] == 401
        # 学生角色 → 403
        forbidden = api_client.get("/api/v1/system/users", headers=_auth(student.id))
        assert forbidden.json()["code"] == 403
        # admin → 200，且行内带 role_code/role_name
        allowed = api_client.get("/api/v1/system/users", headers=_auth(admin.id))
        assert allowed.json()["code"] == 200, allowed.json()
        assert isinstance(allowed.json()["data"], list)
        if allowed.json()["data"]:
            assert "role_code" in allowed.json()["data"][0]
    finally:
        await _drop_users([admin.username, student.username])


@pytest.mark.asyncio
async def test_admin_user_crud_flow(api_client):
    suffix = uuid.uuid4().hex[:8]
    admin_role = await _ensure_role("admin", "系统管理员")
    employee_role = await _ensure_role("employee", "员工")
    student_role = await _ensure_role("student", "学生")
    admin = SysUser(
        username=f"adm_t_{suffix}", password_hash="x", real_name="测试管理员",
        user_type="admin", role_id=admin_role.id, status="normal",
    )
    session = AsyncSessionLocal()
    try:
        session.add(admin)
        await session.commit()
        await session.refresh(admin)
    finally:
        await session.close()
    headers = _auth(admin.id)
    emp_username = f"emp_t_{suffix}"

    try:
        # 创建员工账号，role 决定 user_type
        created = api_client.post(
            "/api/v1/system/users",
            headers=headers,
            json={
                "username": emp_username, "password": "onboard6", "real_name": "新员工",
                "role_id": employee_role.id, "department": "客服部",
            },
        )
        assert created.json()["code"] == 200, created.json()
        target = created.json()["data"]
        assert target["user_type"] == "employee"

        # 重名被拒；新账号可登录
        dup = api_client.post(
            "/api/v1/system/users",
            headers=headers,
            json={"username": emp_username, "password": "onboard6", "real_name": "重名", "role_id": employee_role.id},
        )
        assert dup.json()["code"] != 200
        login = api_client.post("/api/v1/auth/login", json={"username": emp_username, "password": "onboard6"})
        assert login.json()["code"] == 200

        # 停用后无法登录，恢复后可以
        disabled = api_client.put(
            f"/api/v1/system/users/{target['id']}", headers=headers, json={"status": "disabled"}
        )
        assert disabled.json()["data"]["status"] == "disabled"
        blocked = api_client.post("/api/v1/auth/login", json={"username": emp_username, "password": "onboard6"})
        assert blocked.json()["code"] != 200
        api_client.put(f"/api/v1/system/users/{target['id']}", headers=headers, json={"status": "normal"})

        # 改派角色 → user_type 跟随角色变化
        reassigned = api_client.put(
            f"/api/v1/system/users/{target['id']}", headers=headers, json={"role_id": student_role.id}
        )
        assert reassigned.json()["data"]["user_type"] == "student"

        # 自我保护：不能改自己的角色、不能停用自己
        self_role = api_client.put(
            f"/api/v1/system/users/{admin.id}", headers=headers, json={"role_id": student_role.id}
        )
        assert self_role.json()["code"] != 200
        self_disable = api_client.put(
            f"/api/v1/system/users/{admin.id}", headers=headers, json={"status": "disabled"}
        )
        assert self_disable.json()["code"] != 200

        # 重置密码生效
        reset = api_client.put(
            f"/api/v1/system/users/{target['id']}/password", headers=headers, json={"new_password": "brandnew1"}
        )
        assert reset.json()["code"] == 200
        relogin = api_client.post("/api/v1/auth/login", json={"username": emp_username, "password": "brandnew1"})
        assert relogin.json()["code"] == 200
    finally:
        await _drop_users([admin.username, emp_username])


@pytest.mark.asyncio
async def test_admin_role_crud_flow(api_client):
    suffix = uuid.uuid4().hex[:8]
    admin_role = await _ensure_role("admin", "系统管理员")
    admin = SysUser(
        username=f"adm_t_{suffix}", password_hash="x", real_name="测试管理员",
        user_type="admin", role_id=admin_role.id, status="normal",
    )
    session = AsyncSessionLocal()
    try:
        session.add(admin)
        await session.commit()
        await session.refresh(admin)
    finally:
        await session.close()
    headers = _auth(admin.id)
    role_code = f"ops_t_{suffix}"

    try:
        created = api_client.post(
            "/api/v1/system/roles", headers=headers,
            json={"role_code": role_code, "role_name": "运营专员", "description": "测试角色"},
        )
        assert created.json()["code"] == 200, created.json()
        role = created.json()["data"]
        assert role["user_count"] == 0

        dup = api_client.post(
            "/api/v1/system/roles", headers=headers, json={"role_code": role_code, "role_name": "重复"}
        )
        assert dup.json()["code"] != 200

        renamed = api_client.put(
            f"/api/v1/system/roles/{role['id']}", headers=headers,
            json={"role_name": "运营专家", "description": "改名了"},
        )
        assert renamed.json()["data"]["role_name"] == "运营专家"

        # 有账号挂靠时不可删除；解绑后可删；内置 admin 角色不可删
        member = SysUser(
            username=f"mem_t_{suffix}", password_hash="x", real_name="挂靠用户",
            user_type="employee", role_id=role["id"], status="normal",
        )
        session = AsyncSessionLocal()
        try:
            session.add(member)
            await session.commit()
            await session.refresh(member)
        finally:
            await session.close()
        occupied = api_client.delete(f"/api/v1/system/roles/{role['id']}", headers=headers)
        assert occupied.json()["code"] != 200
        await _drop_users([member.username])
        deleted = api_client.delete(f"/api/v1/system/roles/{role['id']}", headers=headers)
        assert deleted.json()["code"] == 200, deleted.json()
        admin_delete = api_client.delete(f"/api/v1/system/roles/{admin_role.id}", headers=headers)
        assert admin_delete.json()["code"] != 200
    finally:
        # 兜底清理：角色若未删除成功也一并移除
        session = AsyncSessionLocal()
        try:
            leftover = (
                await session.execute(select(SysRole).where(SysRole.role_code == role_code))
            ).scalar_one_or_none()
            if leftover is not None:
                await session.delete(leftover)
                await session.commit()
        finally:
            await session.close()
        await _drop_users([admin.username])
