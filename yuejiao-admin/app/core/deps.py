from collections.abc import Iterator

from fastapi import Depends

from app.core.config import settings
from app.db import open_connection
from app.integrations.dify import DifyWorkflowInsightAdapter
from app.modules.report.application import (
    KIND_COMPLAINT_WEEKLY,
    KIND_DAILY_SUMMARY,
    KIND_WEEKLY_SUMMARY,
    ReportApplication,
)
from app.modules.report.clock import ShanghaiClock


def get_conn() -> Iterator:
    conn = open_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_report_app(conn=Depends(get_conn)) -> ReportApplication:
    return ReportApplication(
        conn=conn,
        clock=ShanghaiClock(),
        insight=DifyWorkflowInsightAdapter(
            base_url=settings.dify_api_base,
            api_keys={
                KIND_COMPLAINT_WEEKLY: settings.dify_complaint_weekly_api_key,
                KIND_DAILY_SUMMARY: settings.dify_daily_summary_api_key,
                KIND_WEEKLY_SUMMARY: settings.dify_daily_summary_api_key,
            },
            timeout=settings.dify_timeout_seconds,
        ),
    )
