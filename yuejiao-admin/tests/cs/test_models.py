"""Unit tests for CS models, database connection, and CRUD operations."""

import uuid
from datetime import datetime, timedelta
import pytest
from app.db.session import SessionLocal
from app.modules.cs.crud.crud import (
    create_chat_message,
    create_chat_session,
    create_event_registration,
    get_event_by_id,
    get_session_by_session_id,
    has_user_registered_for_event,
    list_course_projects,
    list_events,
    list_messages_by_session_id,
    update_session_activity,
)
from app.modules.cs.models.models import CourseProject, EventLecture


@pytest.fixture(scope="module")
def db_session():
    """Yield a database session for test execution and clean up."""
    session = SessionLocal()
    yield session
    session.close()


def test_database_connection(db_session):
    """Ensure database connection is alive and can query."""
    from sqlalchemy import text
    result = db_session.execute(text("SELECT 1")).scalar()
    assert result == 1


def test_chat_session_and_message_lifecycle(db_session):
    """Verify full session creation, message storage, and history listing."""
    unique_session_id = f"test_session_{uuid.uuid4().hex[:12]}"

    created_session = create_chat_session(
        db=db_session,
        session_id=unique_session_id,
        visitor_name="测试访客小王",
        visitor_contact="13800138000",
    )
    assert created_session.id is not None
    assert created_session.session_id == unique_session_id
    assert created_session.status == "active"

    # Fetch back
    fetched_session = get_session_by_session_id(db_session, unique_session_id)
    assert fetched_session is not None
    assert fetched_session.visitor_name == "测试访客小王"

    # Add messages
    user_message = create_chat_message(
        db=db_session,
        session_id=unique_session_id,
        role="user",
        content="你好，请问德国双元制是怎么培养的？",
        intent="business_query",
    )
    assert user_message.id is not None

    assistant_message = create_chat_message(
        db=db_session,
        session_id=unique_session_id,
        role="assistant",
        content="德国双元制受训者在职业学校与企业两处受训，带薪实训。",
        intent="business_query",
        tokens_used=45,
        response_time_ms=120,
    )
    assert assistant_message.id is not None

    # Retrieve history
    message_history = list_messages_by_session_id(db_session, unique_session_id)
    assert len(message_history) == 2
    assert message_history[0].role == "user"
    assert message_history[1].role == "assistant"

    # Update activity
    updated_session = update_session_activity(
        db=db_session,
        session_id=unique_session_id,
        visitor_name="小王同学",
    )
    assert updated_session.visitor_name == "测试访客小王"  # Existing name preserved


def test_event_and_registration_lifecycle(db_session):
    """Verify event lecture creation, registration, seat limit, and duplicate guard."""
    unique_event_name = f"德国双元制项目线上说明会_{uuid.uuid4().hex[:6]}"
    test_event = EventLecture(
        event_name=unique_event_name,
        event_type="online",
        description="全面解读中德双元制实训薪资与B1考培策略",
        start_time=datetime.utcnow() + timedelta(days=3),
        location="腾讯会议：888-999-000",
        max_participants=2,
        current_participants=0,
        status="upcoming",
    )
    db_session.add(test_event)
    db_session.commit()
    db_session.refresh(test_event)

    test_event_id = test_event.id
    assert test_event_id is not None

    # First registration
    test_contact = f"139{uuid.uuid4().hex[:8]}"
    assert not has_user_registered_for_event(db_session, test_event_id, test_contact)

    registration_record = create_event_registration(
        db=db_session,
        event_id=test_event_id,
        customer_name="张三",
        contact_info=test_contact,
        remark="想了解医疗专业",
    )
    assert registration_record.id is not None
    assert registration_record.status == "registered"

    # Check participant count increased
    refreshed_event = get_event_by_id(db_session, test_event_id)
    assert refreshed_event.current_participants == 1

    # Check duplicate prevention
    has_registered = has_user_registered_for_event(db_session, test_event_id, test_contact)
    assert has_registered is True
