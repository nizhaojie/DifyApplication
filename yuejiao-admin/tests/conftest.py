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


def insert_daily_report(
    conn,
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

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO employee_daily_report
                (employee_id, report_date, raw_content, content, key_progress, risks, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                employee_id,
                report_date,
                raw_content,
                content,
                json.dumps(key_progress, ensure_ascii=False) if key_progress is not None else None,
                json.dumps(risks, ensure_ascii=False) if risks is not None else None,
                status,
            ),
        )
        return cur.lastrowid


def insert_staff(
    conn,
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
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sys_user (username, password_hash, real_name, user_type, role_id, status)
            VALUES (%s, %s, %s, %s, %s, 'normal')
            """,
            (username, "x", real_name, user_types[role_code], role_ids[role_code]),
        )
        return cur.lastrowid
