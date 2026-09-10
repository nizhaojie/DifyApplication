"""SQLAlchemy ORM models for the Customer Service (cs) module."""

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ChatSession(Base):
    """Customer service conversation session model.

    Single definition of ``chat_session`` shared with the enterprise module
    (enterprise reads it for conversation memory; do not redefine elsewhere).
    """

    __tablename__ = "chat_session"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_chat_session_session_id"),
        Index("ix_chat_session_session_id", "session_id"),
        Index("ix_chat_session_user_id", "user_id"),
        Index("ix_chat_session_status", "status"),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int | None] = mapped_column(BigInteger)
    visitor_name: Mapped[str | None] = mapped_column(String(64))
    visitor_contact: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    last_message_time: Mapped[datetime | None] = mapped_column(DateTime)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    close_time: Mapped[datetime | None] = mapped_column(DateTime)


class ChatMessage(Base):
    """Individual message exchange within a conversation session."""

    __tablename__ = "chat_message"
    __table_args__ = (
        Index("ix_chat_message_session_id", "session_id"),
        Index("ix_chat_message_intent", "intent"),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # user, assistant, system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    intent: Mapped[str | None] = mapped_column(String(64))
    tokens_used: Mapped[int | None] = mapped_column(Integer)
    response_time_ms: Mapped[int | None] = mapped_column(Integer)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class CourseProject(Base):
    """Educational course and study-abroad program model."""

    __tablename__ = "course_project"
    __table_args__ = (
        Index("ix_course_project_category", "category"),
        Index("ix_course_project_status", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(Text)
    target_audience: Mapped[str | None] = mapped_column(String(255))
    price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    duration: Mapped[str | None] = mapped_column(String(64))
    tags: Mapped[list | None] = mapped_column(JSON)
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class EventLecture(Base):
    """Seminar and lecture event model."""

    __tablename__ = "event_lecture"
    __table_args__ = (
        Index("ix_event_lecture_start_time", "start_time"),
        Index("ix_event_lecture_status", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False, default="offline")
    description: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime)
    location: Mapped[str | None] = mapped_column(String(255))
    max_participants: Mapped[int | None] = mapped_column(Integer)
    current_participants: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    organizer_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="upcoming")
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class EventRegistration(Base):
    """Event attendance and signup registration record."""

    __tablename__ = "event_registration"
    __table_args__ = (Index("ix_event_registration_event_id", "event_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    user_id: Mapped[int | None] = mapped_column(BigInteger)
    customer_name: Mapped[str | None] = mapped_column(String(64))
    contact_info: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="registered")
    remark: Mapped[str | None] = mapped_column(String(255))
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class KnowledgeBase(Base):
    """Knowledge base chunk repository for RAG retrieval."""

    __tablename__ = "knowledge_base"
    __table_args__ = (Index("ix_knowledge_base_category", "category"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_file: Mapped[str | None] = mapped_column(String(512))
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    embedding_vector: Mapped[bytes | None] = mapped_column(LargeBinary)
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
