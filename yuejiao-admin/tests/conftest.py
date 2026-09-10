from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.db.session import _get_async_database_url
from app.modules.report.application import ReportApplication
from app.modules.report.clock import FrozenClock
from app.modules.report.insight import FixedInsightAdapter

SHANGHAI = ZoneInfo("Asia/Shanghai")
NOW = datetime(2025, 3, 12, 15, 0, tzinfo=SHANGHAI)
WEEK_START = date(2025, 3, 10)
KIND = "complaint_weekly"


@pytest_asyncio.fixture
async def db():
    """Async session bound to an external transaction, rolled back after each test.

    Mirrors the previous pymysql ``connection.begin() ... rollback()`` isolation:
    inserts performed by the helpers below are visible to ReportApplication
    (same session) and never reach the database.
    """
    engine = create_async_engine(_get_async_database_url())
    async with engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        nested = await conn.begin_nested()

        @event.listens_for(session.sync_session, "after_transaction_end")
        def _restart_savepoint(sess, transaction):  # pragma: no cover - safety net
            nonlocal nested
            if transaction.nested and not transaction._parent.nested:
                nested = conn.sync_connection.begin_nested()

        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()
    await engine.dispose()


@pytest.fixture
def insight():
    return FixedInsightAdapter()


@pytest.fixture
def app(db, insight):
    return ReportApplication(db=db, clock=FrozenClock(NOW), insight=insight)


async def _insert(db: AsyncSession, sql: str, params: tuple) -> int:
    result = await db.execute(text(sql), params)
    return result.lastrowid


async def insert_ticket(
    db,
    *,
    student_id: int,
    created: datetime,
    updated: datetime | None = None,
    category: str | None = "签证办理",
    status: str = "pending",
    satisfaction: int | None = None,
    ticket_type: str = "complaint",
    title: str = "测试工单",
    content: str = "测试内容",
):
    updated = updated or created
    return await _insert(
        db,
        """
        INSERT INTO student_feedback_ticket
            (student_id, ticket_type, category, title, content, status,
             satisfaction, create_time, update_time)
        VALUES (:student_id, :ticket_type, :category, :title, :content, :status,
             :satisfaction, :created, :updated)
        """,
        {
            "student_id": student_id,
            "ticket_type": ticket_type,
            "category": category,
            "title": title,
            "content": content,
            "status": status,
            "satisfaction": satisfaction,
            "created": created.replace(tzinfo=None),
            "updated": updated.replace(tzinfo=None),
        },
    )


async def insert_daily_report(
    db,
    *,
    employee_id: int,
    report_date: date,
    status: str = "submitted",
    content: str = "今日完成客户跟进。",
    key_progress=None,
    risks=None,
    raw_content: str | None = "口述内容",
):
    import json

    return await _insert(
        db,
        """
        INSERT INTO employee_daily_report
            (employee_id, report_date, raw_content, content, key_progress, risks, status)
        VALUES (:employee_id, :report_date, :raw_content, :content, :key_progress, :risks, :status)
        """,
        {
            "employee_id": employee_id,
            "report_date": report_date,
            "raw_content": raw_content,
            "content": content,
            "key_progress": json.dumps(key_progress, ensure_ascii=False) if key_progress is not None else None,
            "risks": json.dumps(risks, ensure_ascii=False) if risks is not None else None,
            "status": status,
        },
    )


async def insert_staff(
    db,
    *,
    username: str,
    real_name: str,
    role_code: str = "employee",
):
    role_ids = {
        "admin": 1,
        "employee": 2,
        "manager": 3,
        "team_leader": 4,
        "student": 5,
    }
    user_types = {
        "admin": "admin",
        "student": "student",
        "employee": "employee",
        "manager": "employee",
        "team_leader": "employee",
    }
    return await _insert(
        db,
        """
        INSERT INTO sys_user (username, password_hash, real_name, user_type, role_id, status)
        VALUES (:username, :password_hash, :real_name, :user_type, :role_id, 'normal')
        """,
        {
            "username": username,
            "password_hash": "x",
            "real_name": real_name,
            "user_type": user_types[role_code],
            "role_id": role_ids[role_code],
        },
    )


async def insert_psych_record(
    db,
    *,
    student_id: int,
    record_date: date,
    emotion_tag: str | None = "焦虑",
    emotion_score: int | None = 40,
    interaction_content: str | None = "交互全文不应进入报告",
    trigger_keywords=None,
):
    import json

    return await _insert(
        db,
        """
        INSERT INTO student_psych_record
            (student_id, emotion_tag, emotion_score, interaction_content,
             trigger_keywords, record_date)
        VALUES (:student_id, :emotion_tag, :emotion_score, :interaction_content,
             :trigger_keywords, :record_date)
        """,
        {
            "student_id": student_id,
            "emotion_tag": emotion_tag,
            "emotion_score": emotion_score,
            "interaction_content": interaction_content,
            "trigger_keywords": json.dumps(trigger_keywords, ensure_ascii=False) if trigger_keywords is not None else None,
            "record_date": record_date,
        },
    )


async def insert_psych_alert(
    db,
    *,
    student_id: int,
    created: datetime,
    risk_level: str = "high",
    status: str = "pending",
    trigger_reason: str = "预警原句不应进入报告",
    resolved_time: datetime | None = None,
):
    return await _insert(
        db,
        """
        INSERT INTO student_psych_alert
            (student_id, trigger_reason, risk_level, status,
             resolved_time, create_time, update_time)
        VALUES (:student_id, :trigger_reason, :risk_level, :status,
             :resolved_time, :created, :created)
        """,
        {
            "student_id": student_id,
            "trigger_reason": trigger_reason,
            "risk_level": risk_level,
            "status": status,
            "resolved_time": None if resolved_time is None else resolved_time.replace(tzinfo=None),
            "created": created.replace(tzinfo=None),
        },
    )


async def insert_psych_profile(
    db,
    *,
    student_id: int,
    risk_level: str = "medium",
    latest_emotion_tag: str | None = "焦虑",
    emotion_score: int | None = 40,
    weekly_summary=None,
):
    import json

    return await _insert(
        db,
        """
        INSERT INTO student_psych_profile
            (student_id, latest_emotion_tag, emotion_score, risk_level, weekly_summary)
        VALUES (:student_id, :latest_emotion_tag, :emotion_score, :risk_level, :weekly_summary)
        """,
        {
            "student_id": student_id,
            "latest_emotion_tag": latest_emotion_tag,
            "emotion_score": emotion_score,
            "risk_level": risk_level,
            "weekly_summary": json.dumps(weekly_summary, ensure_ascii=False) if weekly_summary is not None else None,
        },
    )


async def insert_academic_deadline(
    db,
    *,
    deadline: datetime,
    student_id: int | None,
    title: str = "期末考试",
    deadline_type: str = "exam",
    description: str | None = "节点描述不应编造开学季",
):
    return await _insert(
        db,
        """
        INSERT INTO academic_deadline
            (student_id, deadline_type, title, description, deadline)
        VALUES (:student_id, :deadline_type, :title, :description, :deadline)
        """,
        {
            "student_id": student_id,
            "deadline_type": deadline_type,
            "title": title,
            "description": description,
            "deadline": deadline.replace(tzinfo=None),
        },
    )


async def insert_lead(
    db,
    *,
    customer_name: str,
    created: datetime,
    status: str = "new",
    last_contact: datetime | None = None,
    education_level: str | None = "本科",
    intended_country: str | None = "英国",
    source_channel: str | None = "线上广告",
    lost_reason: str | None = None,
    owner_employee_id: int = 3,
):
    return await _insert(
        db,
        """
        INSERT INTO crm_lead
            (customer_name, education_level, intended_country, source_channel,
             status, owner_employee_id, last_contact_time, lost_reason,
             create_time, update_time)
        VALUES (:customer_name, :education_level, :intended_country, :source_channel,
             :status, :owner_employee_id, :last_contact, :lost_reason,
             :created, :created)
        """,
        {
            "customer_name": customer_name,
            "education_level": education_level,
            "intended_country": intended_country,
            "source_channel": source_channel,
            "status": status,
            "owner_employee_id": owner_employee_id,
            "last_contact": None if last_contact is None else last_contact.replace(tzinfo=None),
            "lost_reason": lost_reason,
            "created": created.replace(tzinfo=None),
        },
    )


async def insert_follow_up(
    db,
    *,
    lead_id: int,
    created: datetime,
    content: str = "电话跟进意向国家与预算。",
    employee_id: int = 3,
    follow_type: str = "phone",
):
    return await _insert(
        db,
        """
        INSERT INTO crm_follow_up
            (lead_id, employee_id, follow_type, content, create_time)
        VALUES (:lead_id, :employee_id, :follow_type, :content, :created)
        """,
        {
            "lead_id": lead_id,
            "employee_id": employee_id,
            "follow_type": follow_type,
            "content": content,
            "created": created.replace(tzinfo=None),
        },
    )


async def insert_customer_profile(
    db,
    *,
    customer_name: str,
    match_result: str = "matched",
):
    return await _insert(
        db,
        """
        INSERT INTO customer_profile
            (customer_name, match_result, matched_product, match_score)
        VALUES (:customer_name, :match_result, :matched_product, :match_score)
        """,
        {
            "customer_name": customer_name,
            "match_result": match_result,
            "matched_product": "留学申请",
            "match_score": 88.0,
        },
    )
