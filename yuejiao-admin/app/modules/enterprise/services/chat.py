from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BizError
from app.integrations.nl2sql.engine import run_nl2sql
from app.integrations.nl2sql.guard import SqlGuardError
from app.modules.enterprise.crud import daily as daily_crud
from app.modules.enterprise.crud import follow_up as follow_crud
from app.modules.enterprise.crud import guide as guide_crud
from app.modules.enterprise.crud import lead as lead_crud
from app.modules.enterprise.crud import ops as ops_crud
from app.modules.enterprise.models.lead import CrmLead
from app.modules.enterprise.services.knowledge import answer as kb_answer
from app.modules.enterprise.services import student_ops
from app.modules.enterprise.services.lead.extract import (
    FOLLOW_TYPES,
    LEAD_STATUSES,
    STATUS_TO_TEXT,
    extract_daily_from_text,
    extract_keyword,
    extract_lead_from_text,
    extract_person_name,
    extract_status,
)
from app.modules.student.models.score import StudentScore
from app.modules.system.models.user import SysUser
from app.utils.serialize import row_to_dict

TERMINAL = {"signed", "lost"}


def dump_lead(lead: CrmLead, owner_name: str | None = None) -> dict:
    data = row_to_dict(lead)
    data["status_text"] = STATUS_TO_TEXT.get(lead.status, lead.status)
    data["owner_name"] = owner_name
    return data


async def create_lead(db: AsyncSession, payload: dict, owner: SysUser) -> dict:
    name = str(payload.get("customer_name") or "").strip()
    if not name:
        raise BizError("客户姓名不能为空")
    status = payload.get("status") or "new"
    if status not in LEAD_STATUSES:
        raise BizError("状态不合法")
    lead = await lead_crud.create_lead(
        db,
        {
            "customer_name": name,
            "contact_info": payload.get("contact_info"),
            "gender": payload.get("gender") or "U",
            "age": payload.get("age"),
            "education_level": payload.get("education_level"),
            "intended_country": payload.get("intended_country"),
            "intended_major": payload.get("intended_major"),
            "background_info": payload.get("background_info"),
            "source_channel": payload.get("source_channel") or "后台录入",
            "status": status,
            "owner_employee_id": payload.get("owner_employee_id") or owner.id,
            "remark": payload.get("remark"),
        },
    )
    return dump_lead(lead, owner.real_name)


async def create_lead_from_text(db: AsyncSession, text: str, owner: SysUser) -> dict:
    try:
        payload = extract_lead_from_text(text, int(owner.id))
    except ValueError as exc:
        raise BizError(str(exc)) from exc
    lead = await lead_crud.create_lead(db, payload)
    return dump_lead(lead, owner.real_name)


async def query_leads(db: AsyncSession, **kwargs) -> tuple[list[dict], int]:
    rows, total = await lead_crud.list_leads(db, **kwargs)
    names = await lead_crud.owner_name_map(db, [int(item.owner_employee_id) for item in rows])
    return [dump_lead(item, names.get(int(item.owner_employee_id))) for item in rows], total


async def get_lead_detail(db: AsyncSession, lead_id: int) -> dict:
    lead = await lead_crud.get_lead(db, lead_id)
    if lead is None:
        raise BizError("客户不存在", code=404)
    follows = await follow_crud.list_follow_ups(db, lead_id)
    names = await lead_crud.owner_name_map(db, [int(lead.owner_employee_id)])
    return {
        "lead": dump_lead(lead, names.get(int(lead.owner_employee_id))),
        "follow_ups": [row_to_dict(item) for item in follows],
    }


async def update_status(db: AsyncSession, lead_id: int, status: str, lost_reason: str | None) -> dict:
    if status not in LEAD_STATUSES:
        raise BizError("状态不合法")
    lead = await lead_crud.get_lead(db, lead_id)
    if lead is None:
        raise BizError("客户不存在", code=404)
    if lead.status in TERMINAL and lead.status != status:
        raise BizError("已签约或已流失的客户不能再改状态")
    if status == "lost" and not str(lost_reason or "").strip():
        raise BizError("流失时必须填写原因")
    lead.status = status
    lead.lost_reason = lost_reason
    await db.commit()
    await db.refresh(lead)
    return dump_lead(lead)


async def update_status_from_text(db: AsyncSession, text: str) -> dict:
    name = extract_person_name(text)
    status = extract_status(text)
    if not name or not status:
        raise BizError("请说「把张三改成已签约」或「张三已流失，不想出国了」")
    leads = await lead_crud.find_leads_by_name(db, name)
    if not leads:
        raise BizError(f"没有找到客户 {name}")
    reason = None
    if status == "lost":
        reason = text
    return await update_status(db, int(leads[0].id), status, reason)


async def add_follow_up(db: AsyncSession, lead_id: int, payload: dict, owner: SysUser) -> dict:
    if await lead_crud.get_lead(db, lead_id) is None:
        raise BizError("客户不存在", code=404)
    follow_type = payload.get("follow_type") or "other"
    if follow_type not in FOLLOW_TYPES:
        raise BizError("跟进方式不合法")
    content = str(payload.get("content") or "").strip()
    if not content:
        raise BizError("跟进内容不能为空")
    item = await follow_crud.add_follow_up(
        db,
        {
            "lead_id": lead_id,
            "employee_id": owner.id,
            "follow_type": follow_type,
            "content": content,
            "next_plan": payload.get("next_plan"),
        },
    )
    return row_to_dict(item)


async def submit_daily_from_text(db: AsyncSession, text: str, owner: SysUser, report_date: date | None = None) -> dict:
    parsed = extract_daily_from_text(text)
    parsed["employee_id"] = owner.id
    parsed["report_date"] = report_date or date.today()
    item = await daily_crud.upsert_daily(db, parsed)
    data = row_to_dict(item)
    data["employee_name"] = owner.real_name
    return data


async def brief(db: AsyncSession, owner: SysUser) -> dict:
    todos = await ops_crud.pending_todos(db, int(owner.id))
    ops = await student_ops.overview(db)
    funnel = await lead_crud.funnel_counts(db)
    return {
        "employee_id": owner.id,
        "employee_name": owner.real_name,
        "pending_todos": len(todos),
        "pending_leave_approvals": ops["pending_leaves"],
        "pending_tickets": ops["open_tickets"],
        "funnel": funnel,
        "todos": [row_to_dict(item) for item in todos],
        "leaves": ops["leaves"][:5],
        "tickets": ops["tickets"][:5],
        "bridge": ops["bridge"],
    }


async def approve_leave(db: AsyncSession, service_id: int, action: str, comment: str | None, owner: SysUser) -> dict:
    if action not in {"approved", "rejected"}:
        raise BizError("审批结果必须是 approved 或 rejected")
    from app.modules.student.models.admin import StudentAdminService

    service = await db.get(StudentAdminService, service_id)
    if service is None:
        raise BizError("请假单不存在", code=404)
    if service.status != "pending":
        raise BizError("该请假已经处理过了")
    service.status = action
    service.approver_id = owner.id
    service.approval_comment = comment
    service.approval_time = datetime.now()
    from app.modules.student.models.info import StudentInfo

    word = "已通过" if action == "approved" else "未通过"
    student_name = None
    info = await db.get(StudentInfo, service.student_id)
    if info is not None:
        student_user = await db.get(SysUser, info.user_id)
        student_name = None if student_user is None else student_user.real_name
        await ops_crud.add_notification(
            db,
            user_id=info.user_id,
            notification_type="leave_result",
            related_type="student_admin_service",
            related_id=service.id,
            title="请假审批结果",
            content=f"你的请假申请{word}。{comment or ''}".strip(),
            channel="system",
            status="pending",
        )
    await ops_crud.complete_related_todo(db, "student_admin_service", int(service.id))
    await db.commit()
    await db.refresh(service)
    data = student_ops.enrich_leave(row_to_dict(service))
    data["student_name"] = student_name
    data["student_notify"] = student_ops.mock_notify_student(
        "leave_result",
        student_name,
        f"你的请假申请{word}。{comment or ''}".strip(),
    )
    return data


async def command_from_text(db: AsyncSession, text: str, owner: SysUser) -> dict:
    if any(token in text for token in ("同意", "批准", "通过", "拒绝", "驳回")) and "请假" in text:
        name = extract_person_name(text)
        if not name:
            raise BizError("没有听清学生姓名")
        found = await ops_crud.find_pending_leave_by_name(db, name)
        if found is None:
            raise BizError(f"没有找到 {name} 的待审批请假")
        service, student = found
        action = "rejected" if any(token in text for token in ("拒绝", "驳回")) else "approved"
        data = await approve_leave(db, int(service.id), action, text, owner)
        data["student_name"] = student.real_name
        data["action_text"] = "已通过" if action == "approved" else "已驳回"
        return {"type": "leave", "result": data}
    if any(token in text for token in ("投诉", "工单")):
        return await student_ops.command_ticket_from_text(db, text, owner)
    if extract_status(text):
        data = await update_status_from_text(db, text)
        return {"type": "lead_status", "result": data}
    raise BizError("没有听懂指令。可以说「同意张三的请假」「把张三的投诉标成已解决」或「把李四改成已签约」")


async def nl2sql(db: AsyncSession, query: str) -> dict:
    try:
        return await run_nl2sql(db, query)
    except SqlGuardError as exc:
        raise BizError(str(exc)) from exc


async def search_guides(db: AsyncSession, keyword: str | None) -> list[dict]:
    rows = await guide_crud.list_guides(db, keyword)
    return [{k: v for k, v in row_to_dict(item).items() if k != "embedding_vector"} for item in rows]


async def add_score(db: AsyncSession, payload: dict, owner: SysUser) -> dict:
    student_id = payload.get("student_id")
    course_name = str(payload.get("course_name") or "").strip()
    if not student_id or not course_name:
        raise BizError("学生和课程不能为空")
    item = StudentScore(
        student_id=student_id,
        course_name=course_name,
        score=payload.get("score"),
        semester=payload.get("semester"),
        credit=payload.get("credit"),
        recorded_by=owner.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return row_to_dict(item)


def identity_reply(query: str, owner: SysUser) -> dict | None:
    compact = query.replace("？", "").replace("?", "").replace(" ", "").replace("啊", "")
    if compact in {"我是谁", "我叫什么", "我的名字", "我是哪位"} or compact.startswith("我是谁"):
        dept = owner.department or "未填部门"
        return {
            "reply": (
                f"你是{owner.real_name}（账号 {owner.username}），{dept}。"
                "当前在粤教企业助手员工端。"
            ),
            "conversation_id": None,
            "source": "local",
            "intent": "identity",
        }
    if compact in {"你是谁", "你叫什么", "你是什么"}:
        return {
            "reply": "我是粤教企业助手，可以录入客户、查跟进、批请假、跟投诉、交日报，也能查公司简称、入职办公和打印机位置。",
            "conversation_id": None,
            "source": "local",
            "intent": "help",
        }
    if any(token in query for token in ("你能做什么", "怎么用", "帮助")):
        return {
            "reply": help_text(),
            "conversation_id": None,
            "source": "local",
            "intent": "help",
        }
    return None


def looks_like_brief(query: str) -> bool:
    if "咨询" in query or "录入" in query:
        return False
    return any(token in query for token in ("待办", "工作概览", "有没有请假", "有没有投诉")) or "今天有什么" in query


def help_text() -> str:
    return (
        "我是粤教企业助手，可以帮你：\n"
        "1. 口述录入客户，例如：张三 13800138000 想咨询美国硕士\n"
        "2. 查客户 / 跟进记录，例如：查一下张三最近跟进记录\n"
        "3. 改状态，例如：把张三改成已签约\n"
        "4. 口述日报，说清进展、问题和明天计划\n"
        "5. 一句话批请假，例如：同意张三的请假\n"
        "6. 查投诉 / 结案，例如：有哪些待处理投诉；把张三的投诉标成已解决\n"
        "7. 问公司简称、入职办公、打印机位置\n"
        "点下面的能力可以直接填例句。"
    )


def greeting(brief_data: dict) -> str:
    name = brief_data.get("employee_name") or "你好"
    return (
        f"{name}，待办 {brief_data.get('pending_todos') or 0} 条，"
        f"待审批请假 {brief_data.get('pending_leave_approvals') or 0} 条，"
        f"待处理投诉 {brief_data.get('pending_tickets') or 0} 条。"
        "可以直接说客户、请假或投诉，或点下面的能力。"
    )


def attach_view(data: dict) -> dict:
    payload = dict(data)
    payload.pop("raw", None)
    source = str(payload.get("source") or "local")
    intent = str(payload.get("intent") or "")
    title = str(payload.get("title") or "").strip()
    if not payload.get("citation"):
        if intent in {"memory", "identity", "self_intro"}:
            payload["citation"] = "对话记忆"
        elif source == "kb" or intent in {"faq", "docs", "guide"}:
            book = {"faq": "常见问答对", "guide": "新人指南", "docs": "企业信息"}.get(intent, "知识库")
            label = "知识库" if book == "知识库" else f"知识库 · {book}"
            if title:
                label = f"{label} · {title}"
            payload["citation"] = label
        else:
            payload["citation"] = "业务办理"
    return payload


def _md_table(rows: list[dict], columns: list[tuple[str, str]] | None = None, limit: int = 8) -> str:
    if not rows:
        return ""
    if columns is None:
        keys = [str(key) for key in list(rows[0].keys())[:6]]
        columns = [(key, key) for key in keys]

    def cell(row: dict, key: str) -> str:
        value = row.get(key)
        if value is None:
            return ""
        text = str(value).replace("|", "/").replace("\n", " ")
        return text[:40]

    header = "| " + " | ".join(label for _, label in columns) + " |"
    sep = "| " + " | ".join("---" for _ in columns) + " |"
    body = ["| " + " | ".join(cell(row, key) for key, _ in columns) + " |" for row in rows[:limit]]
    return "\n".join([header, sep, *body])


def format_local_reply(intent: str, data: dict) -> str:
    if intent == "lead_entry":
        lead = data
        return (
            f"**已录入** {lead['customer_name']}\n\n"
            f"- 电话：{lead.get('contact_info') or '未提供'}\n"
            f"- 意向：{lead.get('intended_country') or '未填'}{lead.get('education_level') or ''}\n"
            f"- 状态：{lead.get('status_text')}"
        )
    if intent == "lead_query":
        items = data.get("items") or []
        if not items:
            return "没有查到匹配的客户。"
        table = _md_table(
            items,
            [
                ("customer_name", "客户"),
                ("contact_info", "电话"),
                ("intended_country", "意向"),
                ("status_text", "状态"),
            ],
        )
        return f"共 **{data.get('total', len(items))}** 位客户：\n\n{table}"
    if intent == "lead_update":
        lead = data
        return f"**{lead['customer_name']}** 已更新为「{lead.get('status_text')}」。看板漏斗会跟着变。"
    if intent == "daily":
        progress = "；".join(data.get("key_progress") or []) or "已记录"
        return (
            f"**日报已提交**\n\n"
            f"- 进展：{progress}\n"
            f"- 问题：{'；'.join(data.get('risks') or []) or '未写'}\n"
            f"- 计划：{data.get('next_plan') or '未写'}"
        )
    if intent == "leave":
        result = data["result"]
        return f"**{result.get('student_name') or '该同学'}** 的请假{result.get('action_text')}。学生助手尚未接通，已记下假通知。"
    if intent == "ticket":
        result = data.get("result") or data
        return f"**{result.get('student_name') or '该同学'}** 的投诉{result.get('action_text') or '已更新'}。学生助手尚未接通，已记下假通知「已解决」。"
    if intent == "ticket_query":
        items = data.get("items") or []
        if not items:
            return "没有待处理的学生投诉。"
        table = _md_table(
            items,
            [
                ("student_name", "学生"),
                ("title", "工单"),
                ("category", "分类"),
                ("status_text", "状态"),
                ("priority_text", "优先级"),
            ],
        )
        return f"学生投诉 **{data.get('total', len(items))}** 条：\n\n{table}"
    if intent == "nl2sql":
        rows = data.get("rows") or []
        if not rows:
            return "已按只读查询，没有结果。"
        table = _md_table(rows)
        extra = f"\n\n共 {data.get('total', len(rows))} 条。"
        return f"查询结果：\n\n{table}{extra}"
    if intent == "brief":
        return (
            f"**{data.get('employee_name')}** 今日概览\n\n"
            f"- 待办 {data.get('pending_todos')} 条\n"
            f"- 待审批请假 {data.get('pending_leave_approvals')} 条\n"
            f"- 待处理投诉 {data.get('pending_tickets')} 条\n"
            f"- 学生助手：未接通（假接口）"
        )
    if intent == "guide":
        items = data.get("items") or []
        if not items:
            return "入职指引里暂时没有匹配内容。"
        return "\n\n".join(f"**{item['title']}**\n\n{item['content'][:400]}" for item in items[:3])
    if intent in {"faq", "docs"}:
        return str(data.get("reply") or "")
    return help_text()


async def handle_local_chat(db: AsyncSession, query: str, owner: SysUser) -> dict:
    text_in = query.strip()
    intent = "help"
    data: dict = {}

    kb_hit = kb_answer(text_in)
    if kb_hit is not None:
        return {
            "reply": kb_hit["reply"],
            "conversation_id": None,
            "source": "kb",
            "intent": kb_hit["intent"],
            "title": kb_hit.get("title"),
            "citation": kb_hit.get("citation"),
            "data": kb_hit,
        }

    quick = identity_reply(text_in, owner)
    if quick is not None:
        return quick

    if any(token in text_in for token in ("同意", "批准", "通过", "拒绝", "驳回")) and "请假" in text_in:
        intent = "leave"
        data = await command_from_text(db, text_in, owner)
    elif any(token in text_in for token in ("投诉", "工单")):
        data = await student_ops.command_ticket_from_text(db, text_in, owner)
        intent = "ticket" if data.get("type") == "ticket" else "ticket_query"
    elif extract_status(text_in) and extract_person_name(text_in):
        intent = "lead_update"
        data = await update_status_from_text(db, text_in)
    elif any(token in text_in for token in ("日报", "今日进展", "明天计划")) or ("今天" in text_in and "跟了" in text_in):
        intent = "daily"
        data = await submit_daily_from_text(db, text_in, owner)
    elif any(token in text_in for token in ("想咨询", "录入", "新客户")) or (
        extract_lead_from_text.__name__ and __looks_like_lead(text_in)
    ):
        intent = "lead_entry"
        data = await create_lead_from_text(db, text_in, owner)
    elif any(token in text_in for token in ("待办", "有没有请假", "有没有投诉", "工作概览", "今天有什么")):
        intent = "brief"
        data = await brief(db, owner)
    elif any(token in text_in for token in ("入职", "制度", "指引", "考勤")):
        intent = "guide"
        data = {"items": await search_guides(db, extract_keyword(text_in))}
    elif any(token in text_in for token in ("查一下", "查询", "跟进记录", "客户列表", "漏斗")):
        if "跟进" in text_in or "SQL" in text_in.upper() or "自然语言" in text_in:
            intent = "nl2sql"
            data = await nl2sql(db, text_in)
        else:
            keyword = extract_keyword(text_in)
            items, total = await query_leads(db, keyword=keyword, page=1, page_size=20)
            intent = "lead_query"
            data = {"items": items, "total": total}
    elif any(token in text_in for token in ("你能做什么", "帮助", "怎么用")):
        intent = "help"
        data = {}
    else:
        if __looks_like_lead(text_in):
            intent = "lead_entry"
            data = await create_lead_from_text(db, text_in, owner)
        else:
            try:
                intent = "nl2sql"
                data = await nl2sql(db, text_in)
            except BizError:
                intent = "help"
                data = {}

    return {
        "reply": format_local_reply(intent, data),
        "conversation_id": None,
        "source": "local",
        "intent": intent,
        "data": data,
    }


def __looks_like_lead(text: str) -> bool:
    import re

    has_name = bool(re.match(r"^[\u4e00-\u9fa5]{2,4}", text.strip()))
    has_phone = bool(re.search(r"1[3-9]\d{9}|1\d{2}x+", text, re.I))
    return has_name and (has_phone or "咨询" in text or "意向" in text)
