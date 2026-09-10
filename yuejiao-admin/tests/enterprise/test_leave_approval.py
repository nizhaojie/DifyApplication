"""请假审批服务测试：驳回必须携带原因，同意允许无备注。"""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import delete

from app.core.exceptions import BizError
from app.db.session import AsyncSessionLocal
from app.modules.enterprise.services.chat import approve_leave
from app.modules.student.models.admin import StudentAdminService
from app.modules.student.models.info import StudentInfo
from app.modules.system.models.user import SysUser


@pytest_asyncio.fixture
async def pending_leave():
    """一条待审批请假单 + 一个审批员工账号，测试结束清理。"""
    suffix = uuid.uuid4().hex[:8]
    approver = SysUser(username=f"mgr_t_{suffix}", password_hash="x", real_name="审批人", user_type="employee", status="normal")
    student_user = SysUser(username=f"stu_t_{suffix}", password_hash="x", real_name="请假学生", user_type="student", status="normal")
    leave = None
    session = AsyncSessionLocal()
    try:
        session.add_all([approver, student_user])
        await session.flush()
        info = StudentInfo(user_id=student_user.id)
        session.add(info)
        await session.flush()
        leave = StudentAdminService(student_id=info.id, service_type="leave", leave_type="sick", reason="测试请假")
        session.add(leave)
        await session.commit()
        for obj in (approver, leave):
            await session.refresh(obj)
        yield session, approver, leave
    finally:
        if leave is not None:
            await session.execute(delete(StudentAdminService).where(StudentAdminService.id == leave.id))
            await session.execute(delete(StudentInfo).where(StudentInfo.user_id == student_user.id))
        await session.execute(delete(SysUser).where(SysUser.id.in_([approver.id, student_user.id])))
        await session.commit()
        await session.close()


async def test_reject_without_comment_raises(pending_leave):
    session, approver, leave = pending_leave
    with pytest.raises(BizError, match="原因"):
        await approve_leave(session, leave.id, "rejected", None, approver)


async def test_reject_with_blank_comment_raises(pending_leave):
    session, approver, leave = pending_leave
    with pytest.raises(BizError, match="原因"):
        await approve_leave(session, leave.id, "rejected", "   ", approver)


async def test_reject_with_comment_succeeds(pending_leave):
    session, approver, leave = pending_leave
    result = await approve_leave(session, leave.id, "rejected", "假期冲突，不予批准", approver)
    assert result["status"] == "rejected"
    assert result["approval_comment"] == "假期冲突，不予批准"


async def test_approve_allows_empty_comment(pending_leave):
    session, approver, leave = pending_leave
    result = await approve_leave(session, leave.id, "approved", None, approver)
    assert result["status"] == "approved"
