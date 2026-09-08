"""Unit tests for Event Lecture Query and Dialogue Registration Closed Loop."""

import uuid
from datetime import datetime, timedelta
import pytest
from app.db.session import SessionLocal
from app.modules.cs.models.models import EventLecture
from app.modules.cs.schemas.schemas import EventRegisterRequest
from app.modules.cs.services.event.event_service import event_service


@pytest.fixture(scope="module")
def db_session():
    """Yield database session for event testing."""
    session = SessionLocal()
    yield session
    session.close()


def test_list_active_events(db_session):
    """Ensure active/upcoming seminar events can be queried."""
    events = event_service.list_active_events(db=db_session)
    assert len(events) >= 3
    first_event = events[0]
    assert first_event.event_name is not None
    assert first_event.start_time is not None


def test_event_registration_success_and_duplicate(db_session):
    """Ensure valid registration succeeds, increments participants, and prevents duplicates."""
    events = event_service.list_active_events(db=db_session)
    target_event = events[0]
    initial_count = target_event.current_participants

    unique_phone = f"137{uuid.uuid4().hex[:8]}"
    register_request = EventRegisterRequest(
        event_id=target_event.id,
        customer_name="李华",
        contact_info=unique_phone,
        remark="对德国双元制非常感兴趣",
    )

    # 1. First registration should succeed
    response_first = event_service.register(db=db_session, payload=register_request)
    assert response_first.is_success is True
    assert response_first.registration_id is not None
    assert "报名成功" in response_first.message

    # Verify participant count incremented
    updated_events = event_service.list_active_events(db=db_session)
    refreshed_event = next(e for e in updated_events if e.id == target_event.id)
    assert refreshed_event.current_participants == initial_count + 1

    # 2. Duplicate registration with same phone should be intercepted
    response_second = event_service.register(db=db_session, payload=register_request)
    assert response_second.is_success is False
    assert "请勿重复提交" in response_second.message


def test_event_capacity_limit_interception(db_session):
    """When event reaches maximum capacity, registration must be intercepted."""
    full_event = EventLecture(
        event_name=f"VIP限额小型沙龙_{uuid.uuid4().hex[:6]}",
        event_type="offline",
        description="名额仅限1人测试",
        start_time=datetime.now() + timedelta(days=2),
        location="广州天河区VIP室",
        max_participants=1,
        current_participants=1,  # Already full
        status="upcoming",
    )
    db_session.add(full_event)
    db_session.commit()
    db_session.refresh(full_event)

    register_request = EventRegisterRequest(
        event_id=full_event.id,
        customer_name="王小明",
        contact_info=f"135{uuid.uuid4().hex[:8]}",
    )
    response = event_service.register(db=db_session, payload=register_request)
    assert response.is_success is False
    assert "已满额" in response.message
