from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.db import open_connection
from app.modules.report.application import ReportApplication
from app.modules.report.clock import FrozenClock
from app.modules.report.insight import FixedInsightAdapter

SHANGHAI = ZoneInfo("Asia/Shanghai")
NOW = datetime(2025, 3, 12, 15, 0, tzinfo=SHANGHAI)
WEEK_START = date(2025, 3, 10)
KIND = "complaint_weekly"


@pytest.fixture
def conn():
    connection = open_connection()
    connection.begin()
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()


@pytest.fixture
def insight():
    return FixedInsightAdapter()


@pytest.fixture
def app(conn, insight):
    return ReportApplication(conn=conn, clock=FrozenClock(NOW), insight=insight)


def insert_ticket(
    conn,
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
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO student_feedback_ticket
                (student_id, ticket_type, category, title, content, status,
                 satisfaction, create_time, update_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                student_id,
                ticket_type,
                category,
                title,
                content,
                status,
                satisfaction,
                created.replace(tzinfo=None),
                updated.replace(tzinfo=None),
            ),
        )
        return cur.lastrowid
