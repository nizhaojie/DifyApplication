from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BizError
from app.modules.enterprise.crud import ops as ops_crud
from app.modules.enterprise.services.lead.extract import extract_person_name
from app.modules.student.models.admin import StudentAdminService
from app.modules.student.models.info import StudentInfo
from app.modules.student.models.ticket import StudentFeedbackTicket
from app.modules.system.models.user import SysUser
from app.utils.serialize import row_to_dict

LEAVE_TYPE_TEXT = {"sick": "病假", "personal": "事假", "emergency": "紧急假"}
LEAVE_STATUS_TEXT = {"pending": "待审批", "approved": "已通过", "rejected": "已驳回", "cancelled": "已取消"}
TICKET_TYPE_TEXT = {"complaint": "投诉", "suggestion": "建议", "consult": "咨询"}
TICKET_STATUS_TEXT = {
    "pending": "待处理",
    "processing": "处理中",
    "resolved": "已解决",
    "closed": "已关闭",
}
TICKET_PRIORITY_TEXT = {"low": "低", "medium": "中", "high": "高", "urgent": "紧急"}
OPEN_TICKET = {"pending", "processing"}


def bridge_status() -> dict:
    return {
        "connected": False,
        "mode": "mock",
        "target": "学生智能助手",
        "note": "学生助手还没接通。员工端读写本库；通知学生走假接口，接通后再换成真实回调。",
    }


def mock_notify_student(kind: str, student_name: str | None, content: str) -> dict:
    return {
        **bridge_status(),
        "kind": kind,
        "student_name": student_name,
        "payload": content,
        "delivered": False,
    }


def enrich_leave(item: dict) -> dict:
    data = dict(item)
    data["leave_type_text"] = LEAVE_TYPE_TEXT.get(str(data.get("leave_type") or ""), data.get("leave_type"))
    data["status_text"] = LEAVE_STATUS_TEXT.get(str(data.get("status") or ""), data.get("status"))
    return data


def enrich_ticket(item: dict) -> dict:
    data = dict(item)
    data["ticket_type_text"] = TICKET_TYPE_TEXT.get(str(data.get("ticket_type") or ""), data.get("ticket_type"))
    data["status_text"] = TICKET_STATUS_TEXT.get(str(data.get("status") or ""), data.get("status"))
    data["priority_text"] = TICKET_PRIORITY_TEXT.get(str(data.get("priority") or ""), data.get("priority"))
    return data


def _filter_status(status: str | None) -> str | None:
    value = (status or "").strip()
    if not value or value in {"all", "*"}:
        return None
    return value


async def list_leaves(db: AsyncSession, status: str | None = None) -> list[dict]:
    return [enrich_leave(item) for item in await ops_crud.list_leaves(db, status=_filter_status(status))]


async def list_tickets(db: AsyncSession, status: str | None = None) -> list[dict]:
    return [enrich_ticket(item) for item in await ops_crud.list_tickets(db, status=_filter_status(status))]


async def overview(db: AsyncSession) -> dict:
    leaves = await list_leaves(db)
    tickets = await list_tickets(db)
    pending_leaves = [item for item in leaves if item.get("status") == "pending"]
    open_tickets = [item for item in tickets if item.get("status") in OPEN_TICKET]
    resolved_tickets = [item for item in tickets if item.get("status") == "resolved"]
    return {
        "bridge": bridge_status(),
        "pending_leaves": len(pending_leaves),
        "open_tickets": len(open_tickets),
        "resolved_tickets": len(resolved_tickets),
        "leaves": pending_leaves[:8],
        "tickets": open_tickets[:8],
    }


async def handle_ticket(
    db: AsyncSession,
    ticket_id: int,
    action: str,
    solution: str | None,
    owner: SysUser,
) -> dict:
    if action not in {"processing", "resolved", "closed"}:
        raise BizError("工单动作必须是 processing / resolved / closed")
    ticket = await db.get(StudentFeedbackTicket, ticket_id)
    if ticket is None:
        raise BizError("投诉工单不存在", code=404)
    if ticket.status in {"resolved", "closed"} and action != ticket.status:
        raise BizError("该工单已经结案")
    if action == "resolved" and not str(solution or "").strip():
        raise BizError("结案时必须填写处理说明")
    ticket.status = action
    ticket.assignee_id = owner.id
    if solution:
        ticket.solution = solution.strip()
    student_name = await _student_name(db, int(ticket.student_id))
    notify = None
    if action == "resolved":
        ticket.is_notified = 1
        content = f"你的投诉「{ticket.title or '工单'}」已解决。{ticket.solution or ''}".strip()
        await _write_student_notice(
            db,
            ticket.student_id,
            notification_type="ticket_resolved",
            related_type="student_feedback_ticket",
            related_id=int(ticket.id),
            title="投诉已解决",
            content=content,
        )
        await ops_crud.complete_related_todo(db, "student_feedback_ticket", int(ticket.id))
        notify = mock_notify_student("ticket_resolved", student_name, content)
    await db.commit()
    await db.refresh(ticket)
    data = enrich_ticket(row_to_dict(ticket))
    data["student_name"] = student_name
    data["student_notify"] = notify
    return data


async def command_ticket_from_text(db: AsyncSession, text: str, owner: SysUser) -> dict:
    name = extract_person_name(text)
    if any(token in text for token in ("解决", "结案", "办结", "已处理", "标成已解决", "标记为已解决")):
        if not name:
            raise BizError("没有听清学生姓名，可以说「把张三的投诉标成已解决」")
        found = await ops_crud.find_open_ticket_by_name(db, name)
        if found is None:
            raise BizError(f"没有找到 {name} 的待处理投诉")
        ticket, student = found
        solution = text
        data = await handle_ticket(db, int(ticket.id), "resolved", solution, owner)
        data["student_name"] = student.real_name
        data["action_text"] = "已解决"
        return {"type": "ticket", "result": data}
    items = await list_tickets(db, status=None)
    if name:
        items = [item for item in items if name in str(item.get("student_name") or "")]
    open_items = [item for item in items if item.get("status") in OPEN_TICKET]
    return {"type": "ticket_query", "items": open_items or items, "total": len(open_items or items)}


async def mock_inbound_leave(db: AsyncSession, payload: dict) -> dict:
    student = await _find_student(db, payload.get("student_name") or payload.get("text") or "张三")
    leave_type = payload.get("leave_type") or "personal"
    if leave_type not in LEAVE_TYPE_TEXT:
        raise BizError("请假类型只能是 sick / personal / emergency")
    start = datetime.now() + timedelta(days=1)
    end = start + timedelta(days=1)
    reason = str(payload.get("reason") or payload.get("text") or payload.get("query") or "学生助手假接口提交的请假").strip()
    service = StudentAdminService(
        student_id=student["student_id"],
        service_type="leave",
        leave_type=leave_type,
        start_time=start,
        end_time=end,
        reason=reason,
        status="pending",
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    data = enrich_leave(row_to_dict(service))
    data["student_name"] = student["student_name"]
    data["student_no"] = student["student_no"]
    data["bridge"] = bridge_status()
    return data


async def mock_inbound_ticket(db: AsyncSession, payload: dict) -> dict:
    student = await _find_student(db, payload.get("student_name") or payload.get("text") or "张三")
    title = str(payload.get("title") or "学生助手假接口提交的投诉").strip()
    content = str(payload.get("content") or payload.get("text") or payload.get("query") or title).strip()
    ticket = StudentFeedbackTicket(
        student_id=student["student_id"],
        ticket_type=payload.get("ticket_type") or "complaint",
        category=payload.get("category") or "其他",
        title=title,
        content=content,
        status="pending",
        priority=payload.get("priority") or "medium",
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    data = enrich_ticket(row_to_dict(ticket))
    data["student_name"] = student["student_name"]
    data["student_no"] = student["student_no"]
    data["bridge"] = bridge_status()
    return data


async def _student_name(db: AsyncSession, student_id: int) -> str | None:
    row = (
        await db.execute(
            select(SysUser.real_name)
            .join(StudentInfo, StudentInfo.user_id == SysUser.id)
            .where(StudentInfo.id == student_id)
        )
    ).scalar_one_or_none()
    return row


async def _write_student_notice(
    db: AsyncSession,
    student_info_id: int,
    **payload,
) -> None:
    info = await db.get(StudentInfo, student_info_id)
    if info is None:
        return
    await ops_crud.add_notification(db, user_id=info.user_id, channel="system", status="pending", **payload)


async def _find_student(db: AsyncSession, hint: str) -> dict:
    name = extract_person_name(hint) or hint.strip()
    like = f"%{name[:4]}%"
    row = (
        await db.execute(
            select(StudentInfo, SysUser)
            .join(SysUser, SysUser.id == StudentInfo.user_id)
            .where(SysUser.real_name.like(like))
            .order_by(StudentInfo.id.desc())
            .limit(1)
        )
    ).first()
    if row is None:
        row = (
            await db.execute(
                select(StudentInfo, SysUser).join(SysUser, SysUser.id == StudentInfo.user_id).order_by(StudentInfo.id.desc()).limit(1)
            )
        ).first()
    if row is None:
        raise BizError("还没有学生档案，先跑演示种子或等学生助手接入")
    info, user = row
    return {"student_id": int(info.id), "student_name": user.real_name, "student_no": info.student_no}
