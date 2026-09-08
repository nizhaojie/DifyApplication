from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from app.modules.report.clock import SHANGHAI
from app.modules.report.insight import InsightError

KIND_COMPLAINT_WEEKLY = "complaint_weekly"
KIND_DAILY_SUMMARY = "daily_summary"
KIND_WEEKLY_SUMMARY = "weekly_summary"
DAILY_SUMMARY_KINDS = {KIND_DAILY_SUMMARY, KIND_WEEKLY_SUMMARY}
EXPECTED_ROLE_CODES = ("employee", "manager", "team_leader")
TITLES = {
    KIND_COMPLAINT_WEEKLY: "投诉处理周报",
    KIND_DAILY_SUMMARY: "员工日报智能汇总",
    KIND_WEEKLY_SUMMARY: "员工日报智能汇总",
}


@dataclass
class Report:
    id: int
    kind: str
    title: str
    period_start: date
    period_end: date
    status: str
    error_message: str | None
    content: dict | None
    created_at: datetime | None


class ReportApplication:
    def __init__(self, conn, clock, insight):
        self._conn = conn
        self._clock = clock
        self._insight = insight

    def generate(self, kind: str, period_start: date) -> Report:
        start, end = resolve_period(period_start, self._clock.now(), kind=kind)
        title = f"{TITLES[kind]} {start.isoformat()} ~ {end.isoformat()}"
        report_id = self._insert_generating(kind, title, start, end)
        try:
            numbers = self._aggregate(kind, start, end)
            insight = self._insight.narrate(kind, insight_payload(kind, numbers))
            content = {"numbers": numbers, "insight": insight}
            self._finish(report_id, "completed", content, None)
        except InsightError as exc:
            self._finish(report_id, "failed", None, str(exc))
        return self._get(report_id)

    def current(self, kind: str, period_start: date) -> Report | None:
        start, _end = resolve_period(period_start, self._clock.now(), kind=kind)
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM report_generation
                WHERE report_type = %s
                  AND period_start = %s
                  AND status = 'completed'
                ORDER BY id DESC
                LIMIT 1
                """,
                (kind, start),
            )
            row = cur.fetchone()
        return _row_to_report(row) if row else None

    def history(self, kind: str) -> list[Report]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM report_generation
                WHERE report_type = %s AND status = 'completed'
                ORDER BY id DESC
                """,
                (kind,),
            )
            rows = cur.fetchall()
        return [_row_to_report(row) for row in rows]

    def _insert_generating(self, kind: str, title: str, start: date, end: date) -> int:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO report_generation
                    (report_type, report_title, period_start, period_end, status)
                VALUES (%s, %s, %s, %s, 'generating')
                """,
                (kind, title, start, end),
            )
            return cur.lastrowid

    def _finish(self, report_id: int, status: str, content: dict | None, error: str | None) -> None:
        payload = json.dumps(content, ensure_ascii=False) if content is not None else None
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE report_generation
                SET status = %s, report_content = %s, error_message = %s
                WHERE id = %s
                """,
                (status, payload, error, report_id),
            )

    def _get(self, report_id: int) -> Report:
        with self._conn.cursor() as cur:
            cur.execute("SELECT * FROM report_generation WHERE id = %s", (report_id,))
            row = cur.fetchone()
        if row is None:
            raise RuntimeError(f"report {report_id} missing after write")
        return _row_to_report(row)

    def _aggregate(self, kind: str, start: date, end: date) -> dict[str, Any]:
        if kind in DAILY_SUMMARY_KINDS:
            return self._aggregate_daily_summary(start, end)
        return self._aggregate_complaint_weekly(start, end)

    def _aggregate_daily_summary(self, start: date, end: date) -> dict[str, Any]:
        expected = self._load_expected_submitters()
        reports = self._load_daily_reports(start, end)
        submitted = [
            {
                "user_id": row["employee_id"],
                "name": row.get("real_name") or "",
                "report_date": row["report_date"].isoformat(),
                "content": row.get("content") or "",
                "key_progress": _decode_json_field(row.get("key_progress")),
                "risks": _decode_json_field(row.get("risks")),
            }
            for row in reports
            if row["status"] == "submitted"
        ]
        submitted_ids = {item["user_id"] for item in submitted}
        missing = [person for person in expected if person["user_id"] not in submitted_ids]
        return {
            "coverage": {
                "expected_count": len(expected),
                "submitted_count": len(submitted_ids),
                "missing_count": len(missing),
                "expected": expected,
                "submitted": submitted,
                "missing": missing,
            }
        }

    def _load_expected_submitters(self) -> list[dict]:
        placeholders = ",".join(["%s"] * len(EXPECTED_ROLE_CODES))
        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT u.id AS user_id, u.real_name AS name
                FROM sys_user u
                JOIN sys_role r ON r.id = u.role_id
                WHERE r.role_code IN ({placeholders})
                ORDER BY u.id
                """,
                EXPECTED_ROLE_CODES,
            )
            return list(cur.fetchall())

    def _load_daily_reports(self, start: date, end: date) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT d.employee_id, d.report_date, d.content, d.key_progress,
                       d.risks, d.status, u.real_name
                FROM employee_daily_report d
                JOIN sys_user u ON u.id = d.employee_id
                WHERE d.report_date BETWEEN %s AND %s
                """,
                (start, end),
            )
            return list(cur.fetchall())

    def _aggregate_complaint_weekly(self, start: date, end: date) -> dict[str, Any]:
        tickets = self._load_complaints()
        end_instant = period_end_instant(end, self._clock.now())
        period_tickets = [ticket for ticket in tickets if in_range(ticket, start, end)]
        prior_tickets = [
            ticket
            for ticket in tickets
            if in_range(ticket, start - timedelta(days=7), end - timedelta(days=7))
        ]
        open_complaints = [
            {
                "student_name": ticket.get("real_name") or "",
                "category": category_name(ticket),
                "elapsed_days": elapsed_days(ticket["create_time"], end_instant),
            }
            for ticket in tickets
            if is_open(ticket) and elapsed_days(ticket["create_time"], end_instant) > 3
        ]
        open_complaints.sort(key=lambda item: item["elapsed_days"], reverse=True)
        return {
            "period_complaint_count": len(period_tickets),
            "wow": wow(len(period_tickets), len(prior_tickets)),
            "yoy": {"label": "样本不足"},
            "categories": bucket_categories(period_tickets),
            "handling": {
                "resolved_or_closed_count": sum(
                    1 for ticket in period_tickets if ticket["status"] in ("resolved", "closed")
                ),
                "open_count": sum(1 for ticket in period_tickets if is_open(ticket)),
                "items": [
                    {
                        "student_name": ticket.get("real_name") or "",
                        "status": ticket["status"],
                        "elapsed_days": handling_elapsed_days(ticket, end_instant),
                    }
                    for ticket in period_tickets
                ],
            },
            "open_complaints": open_complaints,
            "satisfaction": satisfaction(period_tickets),
        }

    def _load_complaints(self) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT t.id, t.student_id, t.ticket_type, t.category, t.status,
                       t.satisfaction, t.create_time, t.update_time, u.real_name
                FROM student_feedback_ticket t
                LEFT JOIN sys_user u ON u.id = t.student_id
                WHERE t.ticket_type = 'complaint'
                """
            )
            return list(cur.fetchall())


def resolve_period(on_date: date, now: datetime, *, kind: str = KIND_COMPLAINT_WEEKLY) -> tuple[date, date]:
    if kind == KIND_DAILY_SUMMARY:
        return on_date, on_date
    monday = on_date - timedelta(days=on_date.weekday())
    today = now.astimezone(SHANGHAI).date()
    this_monday = today - timedelta(days=today.weekday())
    if monday == this_monday:
        return monday, today
    return monday, monday + timedelta(days=6)


def period_end_instant(end: date, now: datetime) -> datetime:
    now = now.astimezone(SHANGHAI)
    if end == now.date():
        return now
    return datetime(end.year, end.month, end.day, 23, 59, 59, tzinfo=SHANGHAI)


def as_shanghai(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=SHANGHAI)
    return value.astimezone(SHANGHAI)


def elapsed_days(created: datetime, end_instant: datetime) -> float:
    seconds = (end_instant - as_shanghai(created)).total_seconds()
    return round(seconds / 86400, 2)


def handling_elapsed_days(ticket: dict, end_instant: datetime) -> float:
    if ticket["status"] in ("resolved", "closed"):
        return elapsed_days(ticket["create_time"], as_shanghai(ticket["update_time"]))
    return elapsed_days(ticket["create_time"], end_instant)


def is_open(ticket: dict) -> bool:
    return ticket["status"] in ("pending", "processing")


def in_range(ticket: dict, start: date, end: date) -> bool:
    created = as_shanghai(ticket["create_time"]).date()
    return start <= created <= end


def category_name(ticket: dict) -> str:
    name = (ticket.get("category") or "").strip()
    return name if name else "其他"


def bucket_categories(tickets: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for ticket in tickets:
        name = category_name(ticket)
        counts[name] = counts.get(name, 0) + 1
    return [
        {"name": name, "count": counts[name]}
        for name in sorted(counts, key=lambda item: (-counts[item], item))
    ]


def wow(current_count: int, prior_count: int) -> dict:
    if prior_count == 0:
        return {"label": "样本不足", "prior_count": 0, "delta": None}
    return {"label": None, "prior_count": prior_count, "delta": current_count - prior_count}


def satisfaction(tickets: list[dict]) -> dict:
    rated = [ticket["satisfaction"] for ticket in tickets if ticket["satisfaction"] is not None]
    unrated_count = len(tickets) - len(rated)
    if not rated:
        return {
            "label": "暂无评价",
            "average": None,
            "rated_count": 0,
            "unrated_count": unrated_count,
        }
    return {
        "label": None,
        "average": round(sum(rated) / len(rated), 2),
        "rated_count": len(rated),
        "unrated_count": unrated_count,
    }


def insight_payload(kind: str, numbers: dict) -> dict:
    if kind in DAILY_SUMMARY_KINDS:
        coverage = numbers.get("coverage") or {}
        missing = list(coverage.get("missing") or [])
        submitted = list(coverage.get("submitted") or [])
        return {**numbers, "insight_detail": (missing + submitted)[:50]}
    open_alerts = list(numbers.get("open_complaints") or [])
    handling = list((numbers.get("handling") or {}).get("items") or [])
    detail = (open_alerts + handling)[:50]
    return {**numbers, "insight_detail": detail}


def _decode_json_field(field: Any) -> Any:
    if isinstance(field, str):
        return json.loads(field)
    return field


def _row_to_report(row: dict) -> Report:
    content = row.get("report_content")
    if isinstance(content, str):
        content = json.loads(content)
    return Report(
        id=row["id"],
        kind=row["report_type"],
        title=row["report_title"],
        period_start=row["period_start"],
        period_end=row["period_end"],
        status=row["status"],
        error_message=row["error_message"],
        content=content,
        created_at=row.get("create_time"),
    )
