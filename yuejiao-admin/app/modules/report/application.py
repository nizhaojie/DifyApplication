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
KIND_PSYCH_WEEKLY = "psych_weekly"
KIND_CUSTOMER_OPS = "customer_ops"
DAILY_SUMMARY_KINDS = {KIND_DAILY_SUMMARY, KIND_WEEKLY_SUMMARY}
EXPECTED_ROLE_CODES = ("employee", "manager", "team_leader")
WEEK_RISK_STATUSES = ("pending", "following")
WATCHLIST_LEVELS = ("medium", "high")
RISK_RANK = {"high": 0, "medium": 1, "low": 2}
INTENT_STATUSES = ("new", "contacting", "qualified")
CHURN_STALL_DAYS = 14
TITLES = {
    KIND_COMPLAINT_WEEKLY: "投诉处理周报",
    KIND_DAILY_SUMMARY: "员工日报智能汇总",
    KIND_WEEKLY_SUMMARY: "员工日报智能汇总",
    KIND_PSYCH_WEEKLY: "学生心理健康周报",
    KIND_CUSTOMER_OPS: "全域客户经营分析",
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
        if kind == KIND_CUSTOMER_OPS:
            return self._aggregate_customer_ops(start, end)
        if kind in DAILY_SUMMARY_KINDS:
            return self._aggregate_daily_summary(start, end)
        if kind == KIND_PSYCH_WEEKLY:
            return self._aggregate_psych_weekly(start, end)
        return self._aggregate_complaint_weekly(start, end)

    def _aggregate_customer_ops(self, start: date, end: date) -> dict[str, Any]:
        leads = self._load_leads()
        follow_ups = self._load_follow_ups()
        end_instant = period_end_instant(end, self._clock.now())
        existed_in_funnel = [lead for lead in leads if funnel_entry_date(lead) <= end]
        intent = [lead for lead in existed_in_funnel if lead["status"] in INTENT_STATUSES]
        signed = [lead for lead in existed_in_funnel if lead["status"] == "signed"]
        lost = [lead for lead in existed_in_funnel if lead["status"] == "lost"]
        new_intent = [lead for lead in leads if is_entered_in_period(lead, start, end)]
        prior_new_intent = [
            lead
            for lead in leads
            if is_entered_in_period(lead, start - timedelta(days=7), end - timedelta(days=7))
        ]
        follow_by_lead: dict[int, list[dict]] = {}
        for row in follow_ups:
            follow_by_lead.setdefault(row["lead_id"], []).append(row)
        return {
            "intent_count": len(intent),
            "signed_count": len(signed),
            "lost_count": len(lost),
            "new_intent_count": len(new_intent),
            "wow": wow(len(new_intent), len(prior_new_intent)),
            "yoy": {"label": "样本不足"},
            "intent": {
                "customers": [customer_item(lead) for lead in intent],
                "new_intent": [new_intent_item(lead) for lead in new_intent],
                "feature_groups": feature_groups(intent),
                "churn_warnings": churn_warning_list(intent, follow_by_lead, end_instant),
            },
            "signed": {
                "customers": [customer_item(lead) for lead in signed],
                "conversion_paths": [
                    conversion_path(lead, follow_by_lead.get(lead["id"]) or [], end_instant)
                    for lead in signed
                ],
                "feature_groups": feature_groups(signed),
            },
            "lost": {
                "customers": [lost_item(lead) for lead in lost],
            },
        }

    def _load_leads(self) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, customer_name, education_level, intended_country, source_channel,
                       status, last_contact_time, lost_reason, create_time
                FROM crm_lead
                """
            )
            return list(cur.fetchall())

    def _load_follow_ups(self) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, lead_id, content, create_time
                FROM crm_follow_up
                ORDER BY create_time
                """
            )
            return list(cur.fetchall())

    def _aggregate_psych_weekly(self, start: date, end: date) -> dict[str, Any]:
        records = self._load_psych_records(start, end)
        recorded_ids = {row["student_id"] for row in records}
        scores = [row["emotion_score"] for row in records if row["emotion_score"] is not None]
        week_risk_students = week_risk_list(self._load_psych_alerts(), start, end)
        watchlist_students = watchlist(self._load_psych_profiles())
        approaching_nodes = approaching_node_list(self._load_academic_deadlines(), start, end)
        return {
            "recorded_student_count": len(recorded_ids),
            "emotion_tags": bucket_emotion_tags(records),
            "average_emotion_score": (
                round(sum(scores) / len(scores), 2) if scores else None
            ),
            "week_risk_count": len(week_risk_students),
            "week_risk_students": week_risk_students,
            "watchlist_count": len(watchlist_students),
            "watchlist_students": watchlist_students,
            "approaching_nodes": approaching_nodes,
        }

    def _load_psych_records(self, start: date, end: date) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.student_id, r.emotion_tag, r.emotion_score, r.record_date,
                       u.real_name
                FROM student_psych_record r
                JOIN sys_user u ON u.id = r.student_id
                WHERE u.user_type = 'student'
                  AND r.record_date BETWEEN %s AND %s
                """,
                (start, end),
            )
            return list(cur.fetchall())

    def _load_psych_alerts(self) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.student_id, a.risk_level, a.status, a.create_time,
                       u.real_name, p.latest_emotion_tag
                FROM student_psych_alert a
                JOIN sys_user u ON u.id = a.student_id
                LEFT JOIN student_psych_profile p ON p.student_id = a.student_id
                WHERE u.user_type = 'student'
                """
            )
            return list(cur.fetchall())

    def _load_psych_profiles(self) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.student_id, p.risk_level, p.latest_emotion_tag, u.real_name
                FROM student_psych_profile p
                JOIN sys_user u ON u.id = p.student_id
                WHERE u.user_type = 'student'
                """
            )
            return list(cur.fetchall())

    def _load_academic_deadlines(self) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT d.student_id, d.title, d.deadline, u.real_name
                FROM academic_deadline d
                JOIN sys_user u ON u.id = d.student_id
                WHERE u.user_type = 'student'
                """
            )
            return list(cur.fetchall())

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


def week_risk_list(alerts: list[dict], start: date, end: date) -> list[dict]:
    chosen: dict[int, dict] = {}
    for alert in alerts:
        if alert["status"] not in WEEK_RISK_STATUSES:
            continue
        created = as_shanghai(alert["create_time"]).date()
        if not (start <= created <= end):
            continue
        student_id = alert["student_id"]
        item = {
            "student_name": alert.get("real_name") or "",
            "risk_level": alert["risk_level"],
            "emotion_tag": alert.get("latest_emotion_tag") or "",
        }
        previous = chosen.get(student_id)
        if previous is None or RISK_RANK.get(item["risk_level"], 9) < RISK_RANK.get(
            previous["risk_level"], 9
        ):
            chosen[student_id] = item
    return list(chosen.values())


def watchlist(profiles: list[dict]) -> list[dict]:
    return [
        {
            "student_name": row.get("real_name") or "",
            "risk_level": row["risk_level"],
            "emotion_tag": row.get("latest_emotion_tag") or "",
        }
        for row in profiles
        if row["risk_level"] in WATCHLIST_LEVELS
    ]


def approaching_node_list(deadlines: list[dict], start: date, end: date) -> list[dict]:
    window_start = start - timedelta(days=7)
    window_end = end + timedelta(days=7)
    nodes = []
    for row in deadlines:
        due = as_shanghai(row["deadline"]).date()
        if window_start <= due <= window_end:
            nodes.append(
                {
                    "student_name": row.get("real_name") or "",
                    "title": row["title"],
                    "deadline": due.isoformat(),
                }
            )
    return nodes


def bucket_emotion_tags(records: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for row in records:
        name = (row.get("emotion_tag") or "").strip()
        if not name:
            continue
        counts[name] = counts.get(name, 0) + 1
    return [
        {"name": name, "count": counts[name]}
        for name in sorted(counts, key=lambda item: (-counts[item], item))
    ]


def funnel_entry_date(lead: dict) -> date:
    return as_shanghai(lead["create_time"]).date()


def is_entered_in_period(lead: dict, start: date, end: date) -> bool:
    entered = funnel_entry_date(lead)
    return start <= entered <= end


def customer_item(lead: dict) -> dict:
    return {
        "name": lead.get("customer_name") or "",
        "status": lead["status"],
        "intended_country": lead.get("intended_country") or "",
        "education_level": lead.get("education_level") or "",
        "source_channel": lead.get("source_channel") or "",
    }


def new_intent_item(lead: dict) -> dict:
    return {
        "name": lead.get("customer_name") or "",
        "entered_on": funnel_entry_date(lead).isoformat(),
    }


def lost_item(lead: dict) -> dict:
    return {
        "name": lead.get("customer_name") or "",
        "status": lead["status"],
        "lost_reason": lead.get("lost_reason") or "",
    }


def group_label(dimension_value: str | None) -> str:
    name = (dimension_value or "").strip()
    return name if name else "其他"


def feature_groups(leads: list[dict]) -> dict[str, list[dict]]:
    return {
        "intended_country": bucket_dimension(leads, "intended_country", is_comma_split=True),
        "education_level": bucket_dimension(leads, "education_level"),
        "source_channel": bucket_dimension(leads, "source_channel"),
    }


def bucket_dimension(leads: list[dict], field: str, *, is_comma_split: bool = False) -> list[dict]:
    counts: dict[str, int] = {}
    for lead in leads:
        dimension_value = lead.get(field)
        if is_comma_split:
            parts = [part.strip() for part in str(dimension_value or "").split(",")]
        else:
            parts = [str(dimension_value or "")]
        labels = [group_label(part) for part in parts]
        unique_labels = list(dict.fromkeys(labels))
        for label in unique_labels:
            counts[label] = counts.get(label, 0) + 1
    return [
        {"name": name, "count": counts[name]}
        for name in sorted(counts, key=lambda item: (-counts[item], item))
    ]


def contacts_by_period_end(lead: dict, follow_ups: list[dict], end_instant: datetime) -> list[datetime]:
    contact_instants: list[datetime] = []
    last_contact = lead.get("last_contact_time")
    if last_contact is not None:
        instant = as_shanghai(last_contact)
        if instant <= end_instant:
            contact_instants.append(instant)
    for row in follow_ups:
        instant = as_shanghai(row["create_time"])
        if instant <= end_instant:
            contact_instants.append(instant)
    if contact_instants:
        return contact_instants
    return [as_shanghai(lead["create_time"])]


def latest_contact(lead: dict, follow_ups: list[dict], end_instant: datetime) -> datetime:
    return max(contacts_by_period_end(lead, follow_ups, end_instant))


def churn_warning_list(
    intent: list[dict],
    follow_by_lead: dict[int, list[dict]],
    end_instant: datetime,
) -> list[dict]:
    warnings = []
    for lead in intent:
        last_seen = latest_contact(lead, follow_by_lead.get(lead["id"]) or [], end_instant)
        stalled_days = elapsed_days(last_seen, end_instant)
        if stalled_days >= CHURN_STALL_DAYS:
            warnings.append(
                {
                    "name": lead.get("customer_name") or "",
                    "last_contact_on": last_seen.date().isoformat(),
                    "stalled_days": stalled_days,
                }
            )
    warnings.sort(key=lambda item: (-item["stalled_days"], item["name"]))
    return warnings


def conversion_path(lead: dict, follow_ups: list[dict], end_instant: datetime) -> dict:
    timeline = []
    for row in follow_ups:
        instant = as_shanghai(row["create_time"])
        if instant <= end_instant:
            timeline.append(
                {
                    "at": instant.isoformat(sep=" "),
                    "content": row.get("content") or "",
                }
            )
    timeline.sort(key=lambda item: item["at"])
    return {
        "name": lead.get("customer_name") or "",
        "status": lead["status"],
        "follow_ups": timeline,
    }


def insight_payload(kind: str, numbers: dict) -> dict:
    if kind == KIND_CUSTOMER_OPS:
        intent = numbers.get("intent") or {}
        warnings = list(intent.get("churn_warnings") or [])
        new_intent = list(intent.get("new_intent") or [])
        paths = list((numbers.get("signed") or {}).get("conversion_paths") or [])
        lost = list((numbers.get("lost") or {}).get("customers") or [])
        return {**numbers, "insight_detail": (warnings + new_intent + paths + lost)[:50]}
    if kind in DAILY_SUMMARY_KINDS:
        coverage = numbers.get("coverage") or {}
        missing = list(coverage.get("missing") or [])
        submitted = list(coverage.get("submitted") or [])
        return {**numbers, "insight_detail": (missing + submitted)[:50]}
    if kind == KIND_PSYCH_WEEKLY:
        week_risk = list(numbers.get("week_risk_students") or [])
        watchlist_students = list(numbers.get("watchlist_students") or [])
        nodes = list(numbers.get("approaching_nodes") or [])
        return {**numbers, "insight_detail": (week_risk + watchlist_students + nodes)[:50]}
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
