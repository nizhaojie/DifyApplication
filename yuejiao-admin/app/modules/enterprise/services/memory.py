"""员工对话记忆：落库历史、代词补全、可清空。用现成的 chat_session / chat_message。"""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.enterprise.crud import memory as memory_crud
from app.modules.enterprise.services.lead.extract import extract_person_name, guess_person_name
from app.modules.system.models.user import SysUser
from app.utils.serialize import row_to_dict

_PRONOUN = re.compile(r"(他的|她的|这个客户|那个客户|这位客户|他|她)")


def apply_context(query: str, recent_user_texts: list[str]) -> str:
    text = (query or "").strip()
    if not text:
        return text
    if guess_person_name(text) or extract_person_name(text):
        return text
    if not _PRONOUN.search(text):
        return text
    name = None
    for item in reversed(recent_user_texts):
        name = guess_person_name(item) or extract_person_name(item)
        if name:
            break
    if not name:
        return text
    filled = _PRONOUN.sub(name, text, count=1)
    if "改成" in filled or "请假" in filled:
        return filled
    if any(token in text for token in ("电话", "联系", "跟进", "查")):
        return f"查一下{name}"
    return filled


def looks_like_memory_ask(query: str) -> bool:
    text = query or ""
    if any(token in text for token in ("改成", "录入", "想咨询", "请假")):
        return False
    return any(token in text for token in ("还记得", "刚才问", "你记得", "记忆里", "上次说"))


def summarize(messages: list[dict], last_person: str | None) -> str:
    if not messages:
        return "我这边还没有你的对话记忆。说一句之后刷新页面也还在。"
    lines = []
    if last_person:
        lines.append(f"最近提到的客户：{last_person}。说「他的电话」我会按这个人补。")
    turns = [item for item in messages if item.get("role") == "user"][-3:]
    if turns:
        asked = "；".join(str(item.get("content") or "")[:24] for item in turns)
        lines.append(f"你最近问过：{asked}。")
    lines.append(f"一共记了 {len(messages)} 条。侧栏「对话记忆」可以查看摘要或清空。")
    return "\n".join(lines)


async def dump_memory(db: AsyncSession, owner: SysUser) -> dict:
    session = await memory_crud.get_or_create_session(db, owner)
    rows = await memory_crud.list_messages(db, session.session_id)
    messages = []
    last_person = None
    for item in rows:
        data = row_to_dict(item)
        source, intent = _split_intent(data.get("intent"))
        data["source"] = source
        data["intent"] = intent
        messages.append(data)
        if item.role == "user":
            last_person = guess_person_name(item.content) or last_person
    return {
        "session_id": session.session_id,
        "conversation_id": session.visitor_contact,
        "last_person": last_person,
        "total": len(messages),
        "messages": messages,
    }


async def remember_turn(
    db: AsyncSession,
    owner: SysUser,
    *,
    query: str,
    reply: str,
    source: str | None,
    intent: str | None,
    conversation_id: str | None,
) -> None:
    session = await memory_crud.get_or_create_session(db, owner)
    tag = f"{source or 'local'}:{intent or 'chat'}"
    await memory_crud.add_message(db, session_id=session.session_id, role="user", content=query, intent=tag)
    await memory_crud.add_message(db, session_id=session.session_id, role="assistant", content=reply, intent=tag)
    await memory_crud.touch_session(db, session, conversation_id)
    await db.commit()


async def recent_user_texts(db: AsyncSession, owner: SysUser) -> list[str]:
    session = await memory_crud.get_or_create_session(db, owner)
    rows = await memory_crud.list_messages(db, session.session_id)
    return [item.content for item in rows if item.role == "user"]


def _split_intent(raw: str | None) -> tuple[str | None, str | None]:
    text = raw or ""
    if ":" in text:
        source, intent = text.split(":", 1)
        return source or None, intent or None
    return None, text or None
