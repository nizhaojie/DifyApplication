"""Database CRUD operations for Customer Service module."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
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

def get_session_by_session_id(
    db: Session, session_id: str
) -> Optional[ChatSession]:
    """Retrieve chat session by unique session identifier."""
    return (
        db.query(ChatSession)
        .filter(ChatSession.session_id == session_id)
        .first()
    )


def create_chat_session(
    db: Session,
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
    db.commit()
    db.refresh(session_record)
    return session_record


def update_session_activity(
    db: Session,
    session_id: str,
    visitor_name: Optional[str] = None,
    visitor_contact: Optional[str] = None,
) -> Optional[ChatSession]:
    """Update last message timestamp and optional visitor contact info."""
    session_record = get_session_by_session_id(db, session_id)
    if session_record:
        session_record.last_message_time = datetime.now()
        if visitor_name and not session_record.visitor_name:
            session_record.visitor_name = visitor_name
        if visitor_contact and not session_record.visitor_contact:
            session_record.visitor_contact = visitor_contact
        db.commit()
        db.refresh(session_record)
    return session_record


def create_chat_message(
    db: Session,
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
    db.commit()
    db.refresh(message_record)
    return message_record


def list_messages_by_session_id(
    db: Session, session_id: str, limit: int = 50
) -> List[ChatMessage]:
    """Retrieve message history for a given session sorted chronologically."""
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.create_time.asc())
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------------------
# Course Project CRUD
# ---------------------------------------------------------------------------

def list_course_projects(
    db: Session, is_active_only: bool = True
) -> List[CourseProject]:
    """List educational programs optionally filtered by active status."""
    query_builder = db.query(CourseProject)
    if is_active_only:
        query_builder = query_builder.filter(CourseProject.status == 1)
    return query_builder.all()


def get_course_project_by_id(
    db: Session, project_id: int
) -> Optional[CourseProject]:
    """Fetch single course program by primary key."""
    return (
        db.query(CourseProject)
        .filter(CourseProject.id == project_id)
        .first()
    )


def bulk_create_course_projects(
    db: Session, project_dictionaries: List[Dict[str, Any]]
) -> int:
    """Batch insert seed course projects."""
    created_count = 0
    for item in project_dictionaries:
        existing_item = (
            db.query(CourseProject)
            .filter(CourseProject.project_name == item["project_name"])
            .first()
        )
        if not existing_item:
            project_instance = CourseProject(**item)
            db.add(project_instance)
            created_count += 1
    db.commit()
    return created_count


# ---------------------------------------------------------------------------
# Event & Registration CRUD
# ---------------------------------------------------------------------------

def list_events(
    db: Session, status_filter: Optional[str] = None
) -> List[EventLecture]:
    """List upcoming or active seminars and lecture events."""
    query_builder = db.query(EventLecture)
    if status_filter:
        query_builder = query_builder.filter(EventLecture.status == status_filter)
    else:
        query_builder = query_builder.filter(
            EventLecture.status.in_(["upcoming", "ongoing"])
        )
    return query_builder.order_by(EventLecture.start_time.asc()).all()


def get_event_by_id(db: Session, event_id: int) -> Optional[EventLecture]:
    """Fetch single event by primary key."""
    return (
        db.query(EventLecture)
        .filter(EventLecture.id == event_id)
        .first()
    )


def has_user_registered_for_event(
    db: Session, event_id: int, contact_info: str
) -> bool:
    """Check if a registrant has already signed up using phone or email."""
    existing_registration = (
        db.query(EventRegistration)
        .filter(
            EventRegistration.event_id == event_id,
            EventRegistration.contact_info == contact_info,
            EventRegistration.status != "cancelled",
        )
        .first()
    )
    return existing_registration is not None


def create_event_registration(
    db: Session,
    event_id: int,
    customer_name: str,
    contact_info: str,
    remark: Optional[str] = None,
) -> EventRegistration:
    """Atomically record event registration and increment participant count."""
    event_record = get_event_by_id(db, event_id)
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
    db.commit()
    db.refresh(registration_record)
    return registration_record


def bulk_create_events(
    db: Session, event_dictionaries: List[Dict[str, Any]]
) -> int:
    """Batch insert seed seminar events."""
    created_count = 0
    for item in event_dictionaries:
        existing_item = (
            db.query(EventLecture)
            .filter(EventLecture.event_name == item["event_name"])
            .first()
        )
        if not existing_item:
            event_instance = EventLecture(**item)
            db.add(event_instance)
            created_count += 1
    db.commit()
    return created_count


# ---------------------------------------------------------------------------
# Knowledge Base CRUD
# ---------------------------------------------------------------------------

def list_knowledge_chunks(
    db: Session, category_filter: Optional[str] = None
) -> List[KnowledgeBase]:
    """Fetch knowledge base chunks, optionally filtered by category."""
    query_builder = db.query(KnowledgeBase).filter(KnowledgeBase.status == 1)
    if category_filter:
        query_builder = query_builder.filter(
            KnowledgeBase.category == category_filter
        )
    return query_builder.all()


def bulk_create_knowledge_chunks(
    db: Session, chunk_dictionaries: List[Dict[str, Any]]
) -> int:
    """Batch insert knowledge base text chunks."""
    created_count = 0
    for chunk in chunk_dictionaries:
        existing_chunk = (
            db.query(KnowledgeBase)
            .filter(
                KnowledgeBase.title == chunk["title"],
                KnowledgeBase.chunk_index == chunk.get("chunk_index", 0),
            )
            .first()
        )
        if not existing_chunk:
            kb_instance = KnowledgeBase(**chunk)
            db.add(kb_instance)
            created_count += 1
    db.commit()
    return created_count


def count_knowledge_chunks(db: Session) -> int:
    """Count total active knowledge chunks stored in database."""
    return (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.status == 1)
        .count()
    )
