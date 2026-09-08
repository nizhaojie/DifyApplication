from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.enterprise.models.memory import ChatMessage, ChatSession
from app.modules.system.models.user import SysUser


def session_key(user_id: int) -> str:
    return f"ea-{user_id}"


async def get_or_create_session(db: AsyncSession, owner: SysUser) -> ChatSession:
    sid = session_key(int(owner.id))
    stmt = select(ChatSession).where(ChatSession.session_id == sid)
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        session = ChatSession(
            session_id=sid,
            user_id=int(owner.id),
            visitor_name=owner.real_name,
            status="active",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
    return session


async def list_messages(db: AsyncSession, session_id: str, limit: int = 80) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.id.asc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def add_message(
    db: AsyncSession,
    *,
    session_id: str,
    role: str,
    content: str,
    intent: str | None = None,
) -> ChatMessage:
    item = ChatMessage(session_id=session_id, role=role, content=content, intent=intent)
    db.add(item)
    return item


async def touch_session(
    db: AsyncSession,
    session: ChatSession,
    conversation_id: str | None,
    preferred_name: str | None = None,
) -> None:
    session.last_message_time = datetime.now()
    session.status = "active"
    if conversation_id:
        session.visitor_contact = conversation_id
    if preferred_name:
        session.visitor_name = preferred_name


async def clear_session(db: AsyncSession, owner: SysUser) -> ChatSession:
    session = await get_or_create_session(db, owner)
    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == session.session_id))
    session.visitor_contact = None
    session.visitor_name = owner.real_name
    session.last_message_time = None
    await db.commit()
    await db.refresh(session)
    return session
