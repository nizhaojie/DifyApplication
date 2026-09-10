"""Unit tests for Event Lecture Query and Dialogue Registration Closed Loop."""

import uuid
from datetime import datetime, timedelta
import pytest
from app.db.session import AsyncSessionLocal
from app.modules.cs.models.models import EventLecture
from app.modules.cs.schemas.schemas import EventRegisterRequest
from app.modules.cs.services.event.event_service import event_service


@pytest.fixture
async def db_session():
    """Yield database session for event testing."""
    session = AsyncSessionLocal()
    yield session
    await session.close()


async def test_list_active_events(db_session):
    """Ensure active/upcoming seminar events can be queried."""
    events = await event_service.list_active_events(db=db_session)
    assert len(events) >= 3
    first_event = events[0]
    assert first_event.event_name is not None
    assert first_event.start_time is not None


async def test_event_registration_success_and_duplicate(db_session):
    """Ensure valid registration succeeds, increments participants, and prevents duplicates."""
    # Create an isolated event for this registration test
    isolated_event = EventLecture(
        event_name=f"专场测试研讨会_{uuid.uuid4().hex[:6]}",
        event_type="online",
        description="专场测试专用说明会",
        start_time=datetime.now() + timedelta(days=7),
        location="腾讯会议：123-456-789",
        max_participants=50,
        current_participants=0,
        status="upcoming",
    )
    db_session.add(isolated_event)
    await db_session.commit()
    await db_session.refresh(isolated_event)

    target_event_id = isolated_event.id
    unique_phone = f"137{uuid.uuid4().hex[:8]}"
    register_request = EventRegisterRequest(
        event_id=target_event_id,
        customer_name="李华",
        contact_info=unique_phone,
        remark="对德国双元制非常感兴趣",
    )

    # 1. First registration should succeed
    response_first = await event_service.register(db=db_session, payload=register_request)
    assert response_first.is_success is True
    assert response_first.registration_id is not None
    assert "报名成功" in response_first.message

    # Verify participant count incremented
    await db_session.refresh(isolated_event)
    assert isolated_event.current_participants == 1

    # 2. Duplicate registration with same phone should be intercepted
    response_second = await event_service.register(db=db_session, payload=register_request)
    assert response_second.is_success is False
    assert "请勿重复提交" in response_second.message


async def test_event_capacity_limit_interception(db_session):
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
    await db_session.commit()
    await db_session.refresh(full_event)

    register_request = EventRegisterRequest(
        event_id=full_event.id,
        customer_name="王小明",
        contact_info=f"135{uuid.uuid4().hex[:8]}",
    )
    response = await event_service.register(db=db_session, payload=register_request)
    assert response.is_success is False
    assert "已满额" in response.message
