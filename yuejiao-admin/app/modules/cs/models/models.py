"""SQLAlchemy ORM models for the Customer Service (cs) module."""

from datetime import datetime
from sqlalchemy import (
    BIGINT,
    JSON,
    Column,
    DateTime,
    Integer,
    LargeBinary,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from app.db.base import Base


class ChatSession(Base):
    """Customer service conversation session model."""

    __tablename__ = "chat_session"

    id = Column(BIGINT, primary_key=True, autoincrement=True)
    session_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(BIGINT, nullable=True, index=True)
    visitor_name = Column(String(64), nullable=True)
    visitor_contact = Column(String(128), nullable=True)
    status = Column(String(32), nullable=False, default="active", index=True)
    last_message_time = Column(DateTime, nullable=True)
    create_time = Column(DateTime, nullable=False, default=datetime.now)
    close_time = Column(DateTime, nullable=True)


class ChatMessage(Base):
    """Individual message exchange within a conversation session."""

    __tablename__ = "chat_message"

    id = Column(BIGINT, primary_key=True, autoincrement=True)
    session_id = Column(String(64), nullable=False, index=True)
    role = Column(String(32), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    intent = Column(String(64), nullable=True, index=True)
    tokens_used = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    create_time = Column(DateTime, nullable=False, default=datetime.now)


class CourseProject(Base):
    """Educational course and study-abroad program model."""

    __tablename__ = "course_project"

    id = Column(BIGINT, primary_key=True, autoincrement=True)
    project_name = Column(String(255), nullable=False)
    category = Column(String(64), nullable=True, index=True)
    description = Column(Text, nullable=True)
    target_audience = Column(String(255), nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    duration = Column(String(64), nullable=True)
    tags = Column(JSON, nullable=True)
    status = Column(SmallInteger, nullable=False, default=1, index=True)
    create_time = Column(DateTime, nullable=False, default=datetime.now)
    update_time = Column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class EventLecture(Base):
    """Seminar and lecture event model."""

    __tablename__ = "event_lecture"

    id = Column(BIGINT, primary_key=True, autoincrement=True)
    event_name = Column(String(255), nullable=False)
    event_type = Column(String(32), nullable=False, default="offline")
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True)
    location = Column(String(255), nullable=True)
    max_participants = Column(Integer, nullable=True)
    current_participants = Column(Integer, nullable=False, default=0)
    organizer_id = Column(BIGINT, nullable=True)
    status = Column(String(32), nullable=False, default="upcoming", index=True)
    create_time = Column(DateTime, nullable=False, default=datetime.now)
    update_time = Column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class EventRegistration(Base):
    """Event attendance and signup registration record."""

    __tablename__ = "event_registration"

    id = Column(BIGINT, primary_key=True, autoincrement=True)
    event_id = Column(BIGINT, nullable=False, index=True)
    user_id = Column(BIGINT, nullable=True)
    customer_name = Column(String(64), nullable=True)
    contact_info = Column(String(128), nullable=True)
    status = Column(String(32), nullable=False, default="registered")
    remark = Column(String(255), nullable=True)
    create_time = Column(DateTime, nullable=False, default=datetime.now)


class KnowledgeBase(Base):
    """Knowledge base chunk repository for RAG retrieval."""

    __tablename__ = "knowledge_base"

    id = Column(BIGINT, primary_key=True, autoincrement=True)
    category = Column(String(32), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    source_file = Column(String(512), nullable=True)
    chunk_index = Column(Integer, nullable=False, default=0)
    embedding_vector = Column(LargeBinary, nullable=True)
    status = Column(SmallInteger, nullable=False, default=1)
    create_time = Column(DateTime, nullable=False, default=datetime.now)
    update_time = Column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class IntentConfig(Base):
    """Conversation intent routing and configuration mapping."""

    __tablename__ = "intent_config"

    id = Column(BIGINT, primary_key=True, autoincrement=True)
    intent_code = Column(String(64), unique=True, nullable=False)
    intent_name = Column(String(64), nullable=False)
    scene = Column(String(32), nullable=False, default="customer_service")
    system_prompt = Column(Text, nullable=True)
    routing_rule = Column(JSON, nullable=True)
    status = Column(SmallInteger, nullable=False, default=1)
    create_time = Column(DateTime, nullable=False, default=datetime.now)
    update_time = Column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
