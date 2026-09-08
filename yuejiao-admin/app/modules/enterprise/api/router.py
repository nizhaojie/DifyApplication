from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_actor, get_current_user, get_db
from app.core.response import ok
from app.integrations.dify.client import dify_client
from app.modules.enterprise.crud import daily as daily_crud
from app.modules.enterprise.crud import lead as lead_crud
from app.modules.enterprise.crud import ops as ops_crud
from app.modules.enterprise.schemas.payload import LeadIn
from app.modules.enterprise.services import chat as chat_service
from app.modules.enterprise.services import memory as memory_service
from app.modules.enterprise.services.knowledge import answer as kb_answer
from app.modules.enterprise.services.knowledge import company_card, guide_catalog, is_empty_kb_reply
from app.modules.system.models.user import SysUser
from app.utils.log import logger
from app.utils.serialize import row_to_dict

router = APIRouter(prefix="/enterprise", tags=["企业智能助手"])


@router.post("/chat")
async def chat(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    original = (body.query or body.text or "").strip()
    if not original:
        return ok(chat_service.attach_view({"reply": chat_service.help_text(), "source": "local", "intent": "help"}))
    session = await memory_service.dump_memory(db, user)
    query = memory_service.apply_context(original, [item["content"] for item in session["messages"] if item.get("role") == "user"])
    conversation_id = body.conversation_id or session.get("conversation_id")
    data = chat_service.attach_view(await _generate_reply(db, user, query, conversation_id))
    try:
        await memory_service.remember_turn(
            db,
            user,
            query=original,
            reply=data.get("reply") or "",
            source=data.get("source"),
            intent=data.get("intent"),
            conversation_id=data.get("conversation_id") or conversation_id,
        )
    except Exception as exc:
        logger.warning("save chat memory failed: %s", exc)
    return ok(data)


async def _generate_reply(db, user: SysUser, query: str, conversation_id: str | None) -> dict:
    if memory_service.looks_like_memory_ask(query):
        snapshot = await memory_service.dump_memory(db, user)
        return {
            "reply": memory_service.summarize(snapshot["messages"], snapshot.get("last_person")),
            "conversation_id": conversation_id,
            "source": "local",
            "intent": "memory",
        }
    quick = chat_service.identity_reply(query, user)
    if quick is not None:
        quick["conversation_id"] = conversation_id
        return quick
    hit = kb_answer(query)
    if hit is not None:
        return {
            "reply": hit["reply"],
            "conversation_id": conversation_id,
            "source": "kb",
            "intent": hit["intent"],
            "title": hit.get("title"),
            "citation": hit.get("citation"),
        }
    from app.modules.enterprise.services.lead.extract import extract_person_name, guess_person_name

    person = extract_person_name(query) or guess_person_name(query)
    if person and any(token in query for token in ("电话", "联系", "查一下", "查询", "跟进")) and "请假" not in query:
        items, total = await chat_service.query_leads(db, keyword=person, page=1, page_size=8)
        payload = {"items": items, "total": total}
        return {
            "reply": chat_service.format_local_reply("lead_query", payload),
            "conversation_id": conversation_id,
            "source": "local",
            "intent": "lead_query",
            "data": payload,
        }
    if chat_service.looks_like_brief(query):
        data = await chat_service.brief(db, user)
        return {
            "reply": chat_service.format_local_reply("brief", data),
            "conversation_id": conversation_id,
            "source": "local",
            "intent": "brief",
            "data": data,
        }
    if dify_client.enabled():
        try:
            data = await dify_client.chat(
                query,
                user=user.username,
                conversation_id=conversation_id,
                inputs={"employee_id": str(user.id)},
            )
            if is_empty_kb_reply(data.get("reply") or ""):
                fallback = kb_answer(query, loose=True)
                if fallback is not None:
                    data["reply"] = fallback["reply"]
                    data["source"] = "kb"
                    data["intent"] = fallback["intent"]
                    data["title"] = fallback.get("title")
                    data["citation"] = fallback.get("citation")
            return data
        except Exception as exc:
            logger.warning("dify chat fallback: %s", exc)
            data = await chat_service.handle_local_chat(db, query, user)
            data["dify_fallback"] = str(exc)
            return data
    return await chat_service.handle_local_chat(db, query, user)


@router.get("/chat-status")
async def chat_status(_: SysUser = Depends(get_current_user)):
    enabled = dify_client.enabled()
    return ok(
        {
            "dify_enabled": enabled,
            "source": "dify" if enabled else "local",
            "app_hint": "已连接",
            "online": True,
        }
    )


@router.get("/company")
async def company(_: SysUser = Depends(get_current_user)):
    return ok(company_card())


@router.get("/guide-catalog")
async def guide_index(_: SysUser = Depends(get_current_user)):
    items = guide_catalog()
    return ok(items, total=len(items))


@router.get("/memory")
async def get_memory(db: AsyncSession = Depends(get_db), user: SysUser = Depends(get_current_user)):
    data = await memory_service.dump_memory(db, user)
    return ok(data, total=data.get("total") or 0)


@router.delete("/memory")
async def reset_memory(db: AsyncSession = Depends(get_db), user: SysUser = Depends(get_current_user)):
    from app.modules.enterprise.crud import memory as memory_crud

    await memory_crud.clear_session(db, user)
    return ok({"cleared": True}, message="对话记忆已清空")


@router.get("/brief")
async def brief(
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    return ok(await chat_service.brief(db, user))


@router.get("/funnel")
async def funnel(db: AsyncSession = Depends(get_db), _: SysUser = Depends(get_actor)):
    return ok(await lead_crud.funnel_counts(db))


@router.post("/leads")
async def create_lead(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    if body.text:
        data = await chat_service.create_lead_from_text(db, body.text, user)
        return ok(data, message="意向客户已录入")
    data = await chat_service.create_lead(db, body.model_dump(), user)
    return ok(data, message="意向客户已录入")


@router.post("/tools/lead-from-text")
async def tool_lead_from_text(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    data = await chat_service.create_lead_from_text(db, body.text or body.query or "", user)
    return ok(data, message="意向客户已录入")


@router.get("/leads")
async def list_leads(
    keyword: str | None = None,
    status: str | None = None,
    owner_employee_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: SysUser = Depends(get_actor),
):
    items, total = await chat_service.query_leads(
        db,
        keyword=keyword,
        status=status,
        owner_employee_id=owner_employee_id,
        page=page,
        page_size=page_size,
    )
    return ok(items, total=total)


@router.post("/tools/lead-query")
async def tool_lead_query(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    _: SysUser = Depends(get_actor),
):
    items, total = await chat_service.query_leads(
        db,
        keyword=body.text or body.query,
        status=body.status,
        page=1,
        page_size=20,
    )
    return ok({"items": items, "total": total}, total=total)


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: int, db: AsyncSession = Depends(get_db), _: SysUser = Depends(get_actor)):
    return ok(await chat_service.get_lead_detail(db, lead_id))


@router.put("/leads/{lead_id}/status")
async def update_lead_status(
    lead_id: int,
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    _: SysUser = Depends(get_actor),
):
    data = await chat_service.update_status(db, lead_id, body.status or "", body.lost_reason)
    return ok(data, message="状态已更新")


@router.post("/tools/lead-update")
async def tool_lead_update(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    _: SysUser = Depends(get_actor),
):
    data = await chat_service.update_status_from_text(db, body.text or body.query or "")
    return ok(data, message="状态已更新")


@router.post("/leads/{lead_id}/follow-ups")
async def add_follow_up(
    lead_id: int,
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    data = await chat_service.add_follow_up(db, lead_id, body.model_dump(), user)
    return ok(data, message="跟进已记录")


@router.get("/leads/{lead_id}/follow-ups")
async def list_follow_ups(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    _: SysUser = Depends(get_actor),
):
    from app.modules.enterprise.crud import follow_up as follow_crud

    rows = await follow_crud.list_follow_ups(db, lead_id)
    return ok([row_to_dict(item) for item in rows], total=len(rows))


@router.post("/dailies")
async def submit_daily(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    data = await chat_service.submit_daily_from_text(db, body.text or body.remark or "", user, body.report_date)
    return ok(data, message="日报已提交")


@router.post("/tools/daily-from-text")
async def tool_daily(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    data = await chat_service.submit_daily_from_text(db, body.text or body.query or "", user, body.report_date)
    return ok(data, message="日报已提交")


@router.get("/dailies")
async def list_dailies(
    employee_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: SysUser = Depends(get_actor),
):
    items, total = await daily_crud.list_dailies(
        db, employee_id=employee_id, start_date=start_date, end_date=end_date, page=page, page_size=page_size
    )
    return ok(items, total=total)


@router.get("/orgs")
async def list_orgs(db: AsyncSession = Depends(get_db), _: SysUser = Depends(get_actor)):
    rows = await ops_crud.list_orgs(db)
    return ok([row_to_dict(item) for item in rows], total=len(rows))


@router.get("/guides")
async def list_guides(keyword: str | None = None, db: AsyncSession = Depends(get_db), _: SysUser = Depends(get_actor)):
    items = await chat_service.search_guides(db, keyword)
    return ok(items, total=len(items))


@router.get("/leaves")
async def list_leaves(status: str | None = "pending", db: AsyncSession = Depends(get_db), _: SysUser = Depends(get_actor)):
    items = await ops_crud.list_leaves(db, status=status)
    return ok(items, total=len(items))


@router.post("/leaves/{service_id}/approve")
async def approve_leave(
    service_id: int,
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    data = await chat_service.approve_leave(db, service_id, body.action or body.status or "approved", body.approval_comment, user)
    return ok(data, message="审批完成")


@router.post("/tools/command")
async def tool_command(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    data = await chat_service.command_from_text(db, body.text or body.query or "", user)
    return ok(data)


@router.get("/tickets")
async def list_tickets(status: str | None = None, db: AsyncSession = Depends(get_db), _: SysUser = Depends(get_actor)):
    items = await ops_crud.list_tickets(db, status=status)
    return ok(items, total=len(items))


@router.post("/nl2sql")
async def nl2sql_api(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    _: SysUser = Depends(get_actor),
):
    data = await chat_service.nl2sql(db, body.query or body.text or "")
    return ok(data)


@router.post("/tools/nl2sql")
async def tool_nl2sql(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    _: SysUser = Depends(get_actor),
):
    data = await chat_service.nl2sql(db, body.query or body.text or "")
    return ok(data)


@router.post("/scores")
async def add_score(
    body: LeadIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_actor),
):
    data = await chat_service.add_score(db, body.model_dump(), user)
    return ok(data, message="成绩已录入")
