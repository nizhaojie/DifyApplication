"""员工对话记忆：落库历史、自称、代词补全、可清空。用现成的 chat_session / chat_message。"""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.enterprise.crud import memory as memory_crud
from app.modules.enterprise.services.lead.extract import PHONE_RE, extract_person_name, guess_person_name
from app.modules.system.models.user import SysUser
from app.utils.serialize import row_to_dict

_PRONOUN = re.compile(r"(他的|她的|这个客户|那个客户|这位客户|他|她)")
_SELF_INTRO = re.compile(
    r"(?:^|[，,。！!？?\s])(?:你好[，,。!]*)?(?:我是|我叫|我的名字是|请叫我|叫我)"
    r"([\u4e00-\u9fa5A-Za-z·]{2,12})"
)
_BAD_SELF_NAME = {"什么", "谁啊", "哪位", "哪个", "啥名", "多少", "顾问", "员工", "客户", "新人"}
_IDENTITY_ASK = (
    "我是谁",
    "我叫什么",
    "我叫啥",
    "我的名字",
    "我是哪位",
    "你知道我是谁",
    "你还记得我是谁",
    "还记得我叫",
    "还记得我是谁",
)


def _compact(query: str) -> str:
    return (query or "").replace("？", "").replace("?", "").replace(" ", "").replace("啊", "").replace("呀", "")


def extract_self_name(text: str) -> str | None:
    raw = (text or "").strip()
    if not raw:
        return None
    if any(token in raw for token in ("想咨询", "录入", "请假", "投诉")) or PHONE_RE.search(raw):
        return None
    if "客户" in raw and not raw.startswith("我"):
        return None
    hit = _SELF_INTRO.search(" " + raw)
    if not hit:
        return None
    name = hit.group(1)
    if name in _BAD_SELF_NAME or name.startswith(("谁", "什么", "哪", "啥")):
        return None
    name = name.rstrip("的了")
    if not name or name in _BAD_SELF_NAME:
        return None
    return name


def looks_like_identity_ask(query: str) -> bool:
    compact = _compact(query)
    if not compact:
        return False
    if extract_self_name(query):
        return False
    return any(token in compact for token in _IDENTITY_ASK) or compact.startswith("我是谁")


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
    if "改成" in filled or "请假" in filled or "投诉" in filled:
        return filled
    if any(token in text for token in ("电话", "联系", "跟进", "查")):
        return f"查一下{name}"
    return filled


def looks_like_memory_ask(query: str) -> bool:
    text = query or ""
    if any(token in text for token in ("改成", "录入", "想咨询", "请假", "投诉")):
        return False
    if looks_like_identity_ask(text) or extract_self_name(text):
        return False
    return any(token in text for token in ("还记得", "刚才问", "刚才说", "你记得", "记忆里", "上次说", "说过什么"))


def _login_line(owner: SysUser) -> str:
    dept = getattr(owner, "department", None) or "未填部门"
    return f"登录账号是{owner.real_name}（{owner.username}），{dept}。"


def summarize(messages: list[dict], last_person: str | None, preferred_name: str | None = None) -> str:
    if not messages and not preferred_name:
        return "我这边还没有你的对话记忆。说一句之后刷新页面也还在。"
    lines = []
    if preferred_name:
        lines.append(f"这轮对话里你告诉我，你是{preferred_name}。问「我是谁」我会按这个答。")
    if last_person:
        lines.append(f"最近提到的客户：{last_person}。说「他的电话」我会按这个人补。")
    turns = [item for item in messages if item.get("role") == "user"][-3:]
    if turns:
        asked = "；".join(str(item.get("content") or "")[:24] for item in turns)
        lines.append(f"你最近说过：{asked}。")
    lines.append(f"一共记了 {len(messages)} 条。点「新对话」或侧栏「对话记忆」可以清空。")
    return "\n".join(lines)


def reply_from_memory(query: str, owner: SysUser, snapshot: dict | None = None) -> dict | None:
    snapshot = snapshot or {}
    preferred = snapshot.get("preferred_name")
    intro = extract_self_name(query)
    if intro:
        same_login = intro == (owner.real_name or "")
        if same_login:
            reply = f"好，我记住了：你是{intro}。{_login_line(owner)}当前在粤教企业助手员工端。"
        else:
            reply = (
                f"好，这轮对话里我记住你是{intro}。你再问「我是谁」我会按这个答。"
                f"{_login_line(owner)}点「新对话」会忘掉自称，账号不会变。"
            )
        return {"reply": reply, "source": "local", "intent": "self_intro"}
    if looks_like_identity_ask(query):
        if preferred and preferred != (owner.real_name or ""):
            reply = (
                f"这轮对话里你告诉我，你是{preferred}。"
                f"{_login_line(owner)}当前在粤教企业助手员工端。"
            )
        else:
            dept = getattr(owner, "department", None) or "未填部门"
            reply = f"你是{owner.real_name}（账号 {owner.username}），{dept}。当前在粤教企业助手员工端。"
        return {"reply": reply, "source": "local", "intent": "identity"}
    if looks_like_memory_ask(query):
        return {
            "reply": summarize(snapshot.get("messages") or [], snapshot.get("last_person"), preferred),
            "source": "local",
            "intent": "memory",
        }
    return None


def memory_hint(snapshot: dict | None) -> str:
    snapshot = snapshot or {}
    parts = []
    if snapshot.get("preferred_name"):
        parts.append(f"用户在本轮对话自称{snapshot['preferred_name']}")
    if snapshot.get("last_person"):
        parts.append(f"最近提到的客户是{snapshot['last_person']}")
    return "。".join(parts)


async def dump_memory(db: AsyncSession, owner: SysUser) -> dict:
    session = await memory_crud.get_or_create_session(db, owner)
    rows = await memory_crud.list_messages(db, session.session_id)
    messages = []
    last_person = None
    preferred_name = None
    for item in rows:
        data = row_to_dict(item)
        source, intent = _split_intent(data.get("intent"))
        data["source"] = source
        data["intent"] = intent
        messages.append(data)
        if item.role == "user":
            last_person = guess_person_name(item.content) or last_person
            intro = extract_self_name(item.content)
            if intro:
                preferred_name = intro
    stored = session.visitor_name
    if not preferred_name and stored and stored != (owner.real_name or ""):
        preferred_name = stored
    return {
        "session_id": session.session_id,
        "conversation_id": session.visitor_contact,
        "last_person": last_person,
        "preferred_name": preferred_name,
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
    await memory_crud.touch_session(
        db,
        session,
        conversation_id,
        preferred_name=extract_self_name(query),
    )
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
