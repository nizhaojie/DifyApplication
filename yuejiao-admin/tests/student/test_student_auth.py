"""学生模块鉴权测试：身份必须由 JWT 登录态推导，伪造 X-User-Id 不再生效。"""

import uuid

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal
from app.main import app
from app.modules.student.models.admin import StudentAdminService
from app.modules.student.models.info import StudentInfo
from app.modules.system.models.user import SysUser


@pytest.fixture(scope="module")
def api_client():
    with TestClient(app) as client:
        yield client


@pytest_asyncio.fixture
async def student_accounts():
    """两组互不相干的学生账号 + 一个无学生档案的员工，测试结束清理全部痕迹。"""
    suffix = uuid.uuid4().hex[:8]
    users = [
        SysUser(username=f"stu_t_{suffix}_a", password_hash="x", real_name="测试学生甲", user_type="student", status="normal"),
        SysUser(username=f"stu_t_{suffix}_b", password_hash="x", real_name="测试学生乙", user_type="student", status="normal"),
        SysUser(username=f"emp_t_{suffix}", password_hash="x", real_name="测试员工", user_type="employee", status="normal"),
    ]
    infos = []
    session = AsyncSessionLocal()
    try:
        session.add_all(users)
        await session.flush()
        infos = [
            StudentInfo(user_id=users[0].id, student_no=f"T{suffix}a"),
            StudentInfo(user_id=users[1].id, student_no=f"T{suffix}b"),
        ]
        session.add_all(infos)
        await session.commit()
        for info in infos:
            await session.refresh(info)
        yield users[0], infos[0], users[1], infos[1], users[2]
    finally:
        student_ids = [info.id for info in infos]
        if student_ids:
            await session.execute(delete(StudentAdminService).where(StudentAdminService.student_id.in_(student_ids)))
        await session.execute(delete(StudentInfo).where(StudentInfo.user_id.in_([u.id for u in users])))
        await session.execute(delete(SysUser).where(SysUser.id.in_([u.id for u in users])))
        await session.commit()
        await session.close()


def _auth(user_id: int) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id, 'stu')}"}


async def test_overview_without_token_rejected(api_client, student_accounts):
    resp = api_client.get("/api/v1/student/overview")
    assert resp.status_code == 200
    assert resp.json()["code"] == 401


async def test_forged_x_user_id_header_ignored(api_client, student_accounts):
    """旧契约：不带 token、只伪造 X-User-Id 即可冒充学生；现在必须被拒绝。"""
    _, info_a, _, _, _ = student_accounts
    resp = api_client.get("/api/v1/student/leaves", headers={"X-User-Id": str(info_a.id)})
    assert resp.json()["code"] == 401


async def test_student_only_sees_own_leaves(api_client, student_accounts):
    user_a, info_a, user_b, info_b, _ = student_accounts
    session = AsyncSessionLocal()
    try:
        session.add_all([
            StudentAdminService(student_id=info_a.id, service_type="leave", leave_type="sick", reason="甲的请假"),
            StudentAdminService(student_id=info_b.id, service_type="leave", leave_type="personal", reason="乙的请假"),
        ])
        await session.commit()
    finally:
        await session.close()
    resp = api_client.get("/api/v1/student/leaves", headers=_auth(user_a.id))
    body = resp.json()
    assert body["code"] == 200
    reasons = [item["reason"] for item in body["data"]]
    assert "甲的请假" in reasons
    assert "乙的请假" not in reasons


async def test_create_leave_binds_to_derived_student(api_client, student_accounts):
    user_a, info_a, _, _, _ = student_accounts
    payload = {
        "leave_type": "sick",
        "start_time": "2026-09-11T08:00:00",
        "end_time": "2026-09-12T08:00:00",
        "reason": "身体不适",
    }
    resp = api_client.post("/api/v1/student/leaves", json=payload, headers=_auth(user_a.id))
    assert resp.status_code == 201
    assert resp.json()["data"]["student_id"] == info_a.id


async def test_user_without_student_profile_forbidden(api_client, student_accounts):
    employee = student_accounts[4]
    resp = api_client.get("/api/v1/student/overview", headers=_auth(employee.id))
    assert resp.json()["code"] == 403
    assert "学生档案" in resp.json()["message"]
