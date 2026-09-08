from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.student.models.admin import StudentAdminService
from app.modules.student.models.info import StudentInfo
from app.modules.student.models.ticket import StudentFeedbackTicket
from app.modules.system.models.notification import NotificationLog
from app.modules.system.models.org import SysOrganization
from app.modules.system.models.todo import TodoItem
from app.modules.system.models.user import SysUser
from app.utils.serialize import row_to_dict


async def list_leaves(db: AsyncSession, status: str | None = None) -> list[dict]:
    stmt = (
        select(StudentAdminService, StudentInfo, SysUser.real_name)
        .join(StudentInfo, StudentInfo.id == StudentAdminService.student_id, isouter=True)
        .join(SysUser, SysUser.id == StudentInfo.user_id, isouter=True)
        .where(StudentAdminService.service_type == "leave")
    )
    if status:
        stmt = stmt.where(StudentAdminService.status == status)
    rows = (await db.execute(stmt.order_by(StudentAdminService.id.desc()))).all()
    items = []
    for service, info, real_name in rows:
        item = row_to_dict(service)
        item["student_name"] = real_name
        item["student_no"] = None if info is None else info.student_no
        items.append(item)
    return items


async def find_pending_leave_by_name(db: AsyncSession, name: str) -> tuple[StudentAdminService, SysUser] | None:
    like = f"%{name}%"
    row = (
        await db.execute(
            select(StudentAdminService, SysUser)
            .join(StudentInfo, StudentInfo.id == StudentAdminService.student_id)
            .join(SysUser, SysUser.id == StudentInfo.user_id)
            .where(
                StudentAdminService.service_type == "leave",
                StudentAdminService.status == "pending",
                SysUser.real_name.like(like),
            )
            .order_by(StudentAdminService.id.desc())
            .limit(1)
        )
    ).first()
    if row is None:
        return None
    return row[0], row[1]


async def list_tickets(db: AsyncSession, status: str | None = None) -> list[dict]:
    stmt = (
        select(StudentFeedbackTicket, StudentInfo, SysUser.real_name)
        .join(StudentInfo, StudentInfo.id == StudentFeedbackTicket.student_id, isouter=True)
        .join(SysUser, SysUser.id == StudentInfo.user_id, isouter=True)
    )
    if status:
        stmt = stmt.where(StudentFeedbackTicket.status == status)
    rows = (await db.execute(stmt.order_by(StudentFeedbackTicket.id.desc()))).all()
    items = []
    for ticket, info, real_name in rows:
        item = row_to_dict(ticket)
        item["student_name"] = real_name
        item["student_no"] = None if info is None else info.student_no
        items.append(item)
    return items


async def list_orgs(db: AsyncSession) -> list[SysOrganization]:
    rows = (
        await db.execute(
            select(SysOrganization).where(SysOrganization.status == 1).order_by(SysOrganization.sort_order, SysOrganization.id)
        )
    ).scalars().all()
    return list(rows)


async def pending_todos(db: AsyncSession, assignee_id: int) -> list[TodoItem]:
    rows = (
        await db.execute(
            select(TodoItem)
            .where(TodoItem.assignee_id == assignee_id, TodoItem.status.in_(["pending", "in_progress"]))
            .order_by(TodoItem.id.desc())
            .limit(20)
        )
    ).scalars().all()
    return list(rows)


async def add_notification(db: AsyncSession, **payload) -> None:
    db.add(NotificationLog(**payload))


async def complete_related_todo(db: AsyncSession, related_type: str, related_id: int) -> None:
    rows = (
        await db.execute(
            select(TodoItem).where(
                TodoItem.related_type == related_type,
                TodoItem.related_id == related_id,
                TodoItem.status.in_(["pending", "in_progress"]),
            )
        )
    ).scalars().all()
    now = datetime.now()
    for item in rows:
        item.status = "done"
        item.completed_time = now
