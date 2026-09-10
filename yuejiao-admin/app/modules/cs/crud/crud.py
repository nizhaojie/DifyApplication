"""Database CRUD operations for Customer Service module (async)."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cs.models.models import (
    ChatMessage,
    ChatSession,
    CourseProject,
    EventLecture,
    EventRegistration,
    KnowledgeBase,
)


# ---------------------------------------------------------------------------
# Session & Message CRUD
# ---------------------------------------------------------------------------

async def get_session_by_session_id(
    db: AsyncSession, session_id: str
) -> Optional[ChatSession]:
    """Retrieve chat session by unique session identifier."""
    result = await db.execute(
        select(ChatSession).where(ChatSession.session_id == session_id)
    )
    return result.scalar_one_or_none()


async def create_chat_session(
    db: AsyncSession,
    session_id: str,
    visitor_name: Optional[str] = None,
    visitor_contact: Optional[str] = None,
) -> ChatSession:
    """Create and persist a new customer conversation session."""
    session_record = ChatSession(
        session_id=session_id,
        visitor_name=visitor_name,
        visitor_contact=visitor_contact,
        status="active",
        last_message_time=datetime.now(),
    )
    db.add(session_record)
    await db.commit()
    await db.refresh(session_record)
    return session_record


async def update_session_activity(
    db: AsyncSession,
    session_id: str,
    visitor_name: Optional[str] = None,
    visitor_contact: Optional[str] = None,
) -> Optional[ChatSession]:
    """Update last message timestamp and optional visitor contact info."""
    session_record = await get_session_by_session_id(db, session_id)
    if session_record:
        session_record.last_message_time = datetime.now()
        if visitor_name and not session_record.visitor_name:
            session_record.visitor_name = visitor_name
        if visitor_contact and not session_record.visitor_contact:
            session_record.visitor_contact = visitor_contact
        await db.commit()
        await db.refresh(session_record)
    return session_record


async def create_chat_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
    intent: Optional[str] = None,
    tokens_used: Optional[int] = None,
    response_time_ms: Optional[int] = None,
) -> ChatMessage:
    """Save an incoming or outgoing conversation message."""
    message_record = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        intent=intent,
        tokens_used=tokens_used,
        response_time_ms=response_time_ms,
        create_time=datetime.now(),
    )
    db.add(message_record)
    await db.commit()
    await db.refresh(message_record)
    return message_record


async def list_messages_by_session_id(
    db: AsyncSession, session_id: str, limit: int = 50
) -> List[ChatMessage]:
    """Retrieve message history for a given session sorted chronologically."""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.create_time.asc())
        .limit(limit)
    )
    return list(result.scalars())


# ---------------------------------------------------------------------------
# Course Project CRUD
# ---------------------------------------------------------------------------

async def list_course_projects(
    db: AsyncSession, is_active_only: bool = True
) -> List[CourseProject]:
    """List educational programs optionally filtered by active status."""
    query = select(CourseProject)
    if is_active_only:
        query = query.where(CourseProject.status == 1)
    result = await db.execute(query)
    return list(result.scalars())


async def get_course_project_by_id(
    db: AsyncSession, project_id: int
) -> Optional[CourseProject]:
    """Fetch single course program by primary key."""
    result = await db.execute(
        select(CourseProject).where(CourseProject.id == project_id)
    )
    return result.scalar_one_or_none()


async def bulk_create_course_projects(
    db: AsyncSession, project_dictionaries: List[Dict[str, Any]]
) -> int:
    """Batch insert seed course projects."""
    created_count = 0
    for item in project_dictionaries:
        existing_item = await db.execute(
            select(CourseProject).where(CourseProject.project_name == item["project_name"])
        )
        if existing_item.scalar_one_or_none() is None:
            project_instance = CourseProject(**item)
            db.add(project_instance)
            created_count += 1
    await db.commit()
    return created_count


# ---------------------------------------------------------------------------
# Event & Registration CRUD
# ---------------------------------------------------------------------------

async def list_events(
    db: AsyncSession, status_filter: Optional[str] = None
) -> List[EventLecture]:
    """List upcoming or active seminars and lecture events."""
    query = select(EventLecture)
    if status_filter:
        query = query.where(EventLecture.status == status_filter)
    else:
        query = query.where(EventLecture.status.in_(["upcoming", "ongoing"]))
    result = await db.execute(query.order_by(EventLecture.start_time.asc()))
    return list(result.scalars())


async def get_event_by_id(db: AsyncSession, event_id: int) -> Optional[EventLecture]:
    """Fetch single event by primary key."""
    result = await db.execute(select(EventLecture).where(EventLecture.id == event_id))
    return result.scalar_one_or_none()


async def has_user_registered_for_event(
    db: AsyncSession, event_id: int, contact_info: str
) -> bool:
    """Check if a registrant has already signed up using phone or email."""
    existing_registration = await db.execute(
        select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.contact_info == contact_info,
            EventRegistration.status != "cancelled",
        )
    )
    return existing_registration.scalar_one_or_none() is not None


async def list_event_registrations_by_contact(
    db: AsyncSession, contact_info: str
) -> List[EventRegistration]:
    """Retrieve all active event registrations for a given contact (phone/wechat)."""
    result = await db.execute(
        select(EventRegistration)
        .where(
            EventRegistration.contact_info == contact_info.strip(),
            EventRegistration.status != "cancelled",
        )
        .order_by(EventRegistration.create_time.desc())
    )
    return list(result.scalars())


async def create_event_registration(
    db: AsyncSession,
    event_id: int,
    customer_name: str,
    contact_info: str,
    remark: Optional[str] = None,
) -> EventRegistration:
    """Atomically record event registration and increment participant count."""
    event_record = await get_event_by_id(db, event_id)
    if not event_record:
        raise ValueError(f"Event with ID {event_id} does not exist.")

    registration_record = EventRegistration(
        event_id=event_id,
        customer_name=customer_name,
        contact_info=contact_info,
        remark=remark,
        status="registered",
        create_time=datetime.now(),
    )
    db.add(registration_record)

    event_record.current_participants += 1
    await db.commit()
    await db.refresh(registration_record)
    return registration_record


async def bulk_create_events(
    db: AsyncSession, event_dictionaries: List[Dict[str, Any]]
) -> int:
    """Batch insert seed seminar events."""
    created_count = 0
    for item in event_dictionaries:
        existing_item = await db.execute(
            select(EventLecture).where(EventLecture.event_name == item["event_name"])
        )
        if existing_item.scalar_one_or_none() is None:
            event_instance = EventLecture(**item)
            db.add(event_instance)
            created_count += 1
    await db.commit()
    return created_count


# ---------------------------------------------------------------------------
# Knowledge Base CRUD
# ---------------------------------------------------------------------------

async def list_knowledge_chunks(
    db: AsyncSession, category_filter: Optional[str] = None
) -> List[KnowledgeBase]:
    """Fetch knowledge base chunks, optionally filtered by category."""
    query = select(KnowledgeBase).where(KnowledgeBase.status == 1)
    if category_filter:
        query = query.where(KnowledgeBase.category == category_filter)
    result = await db.execute(query)
    return list(result.scalars())


async def bulk_create_knowledge_chunks(
    db: AsyncSession, chunk_dictionaries: List[Dict[str, Any]]
) -> int:
    """Batch insert knowledge base text chunks."""
    created_count = 0
    for chunk in chunk_dictionaries:
        existing_chunk = await db.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.title == chunk["title"],
                KnowledgeBase.chunk_index == chunk.get("chunk_index", 0),
            )
        )
        if existing_chunk.scalar_one_or_none() is None:
            kb_instance = KnowledgeBase(**chunk)
            db.add(kb_instance)
            created_count += 1
    await db.commit()
    return created_count


async def count_knowledge_chunks(db: AsyncSession) -> int:
    """Count total active knowledge chunks stored in database."""
    result = await db.execute(
        select(func.count())
        .select_from(KnowledgeBase)
        .where(KnowledgeBase.status == 1)
    )
    return int(result.scalar_one())
