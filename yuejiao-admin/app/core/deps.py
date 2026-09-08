from collections.abc import Iterator

from fastapi import Depends

from app.db import open_connection
from app.modules.report.application import ReportApplication
from app.modules.report.clock import ShanghaiClock
from app.modules.report.insight import FixedInsightAdapter


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
    return ReportApplication(conn=conn, clock=ShanghaiClock(), insight=FixedInsightAdapter())
