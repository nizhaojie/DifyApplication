import json
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from tests.conftest import (
    NOW,
    WEEK_START,
    insert_academic_deadline,
    insert_psych_alert,
    insert_psych_profile,
    insert_psych_record,
    insert_staff,
)
from app.modules.report.application import ReportApplication
from app.modules.report.clock import FrozenClock
from app.modules.report.insight import FailingInsightAdapter, FixedInsightAdapter

KIND = "psych_weekly"
SHANGHAI = ZoneInfo("Asia/Shanghai")
LIN = 17  # 林平磊
GAO = 18  # 高杰
HU = 19  # 胡鑫伟
QUOTE = "这是交互全文原话XYZ"
ALERT_QUOTE = "这是预警原句ABC"


def _at(day: date, hour: int = 15, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=SHANGHAI)


async def test_empty_period_yields_completed_empty_current_report(app):
    report = await app.generate(KIND, WEEK_START)

    assert report.status == "completed"
    numbers = report.content["numbers"]
    assert numbers["recorded_student_count"] == 0
    assert numbers["emotion_tags"] == []
    assert numbers["average_emotion_score"] is None
    assert numbers["week_risk_count"] == 0
    assert numbers["week_risk_students"] == []
    assert numbers["watchlist_count"] == 0
    assert numbers["watchlist_students"] == []
    assert numbers["approaching_nodes"] == []

    current = await app.current(KIND, WEEK_START)
    assert current is not None
    assert current.id == report.id
    assert current.status == "completed"


async def test_empty_report_insight_narrates_nobody_recorded(app):
    report = await app.generate(KIND, WEEK_START)

    assert report.status == "completed"
    assert "本周无人有心理记录" in report.content["insight"]["overview_narrative"]
    assert report.content["insight"]["suggested_action"]


async def test_overall_stats_count_students_tags_and_average(app, db):
    await insert_psych_record(
        db, student_id=LIN, record_date=date(2025, 3, 11), emotion_tag="焦虑", emotion_score=40
    )
    await insert_psych_record(
        db, student_id=LIN, record_date=date(2025, 3, 12), emotion_tag="低落", emotion_score=20
    )
    await insert_psych_record(
        db, student_id=GAO, record_date=date(2025, 3, 11), emotion_tag="焦虑", emotion_score=60
    )
    await insert_psych_record(
        db, student_id=HU, record_date=date(2025, 3, 1), emotion_tag="平稳", emotion_score=80
    )

    report = await app.generate(KIND, WEEK_START)
    numbers = report.content["numbers"]

    assert numbers["recorded_student_count"] == 2
    assert numbers["emotion_tags"] == [{"name": "焦虑", "count": 2}, {"name": "低落", "count": 1}]
    assert numbers["average_emotion_score"] == 40.0


async def test_week_risk_excludes_resolved_and_outside_period(app, db):
    await insert_psych_profile(db, student_id=LIN, risk_level="high", latest_emotion_tag="低落")
    await insert_psych_alert(
        db, student_id=LIN, created=_at(date(2025, 3, 11)), status="pending", risk_level="high"
    )
    await insert_psych_alert(
        db, student_id=GAO, created=_at(date(2025, 3, 11)), status="resolved", risk_level="high"
    )
    await insert_psych_alert(
        db, student_id=HU, created=_at(date(2025, 3, 1)), status="following", risk_level="medium"
    )
    await insert_psych_alert(
        db, student_id=GAO, created=_at(date(2025, 3, 12)), status="following", risk_level="medium"
    )

    report = await app.generate(KIND, WEEK_START)
    names = [item["student_name"] for item in report.content["numbers"]["week_risk_students"]]

    assert report.content["numbers"]["week_risk_count"] == 2
    assert set(names) == {"林平磊", "高杰"}
    lin = next(item for item in report.content["numbers"]["week_risk_students"] if item["student_name"] == "林平磊")
    assert lin["risk_level"] == "high"
    assert lin["emotion_tag"] == "低落"


async def test_watchlist_is_separate_from_week_risk(app, db):
    await insert_psych_profile(db, student_id=LIN, risk_level="high", latest_emotion_tag="低落")
    await insert_psych_profile(db, student_id=GAO, risk_level="medium", latest_emotion_tag="焦虑")
    await insert_psych_profile(db, student_id=HU, risk_level="low", latest_emotion_tag="平稳")
    await insert_psych_alert(
        db, student_id=LIN, created=_at(date(2025, 3, 11)), status="pending", risk_level="high"
    )

    report = await app.generate(KIND, WEEK_START)
    numbers = report.content["numbers"]
    week_risk_names = [item["student_name"] for item in numbers["week_risk_students"]]
    watch_names = [item["student_name"] for item in numbers["watchlist_students"]]

    assert numbers["week_risk_count"] == 1
    assert week_risk_names == ["林平磊"]
    assert numbers["watchlist_count"] == 2
    assert set(watch_names) == {"林平磊", "高杰"}
    assert "胡鑫伟" not in watch_names
    assert numbers["week_risk_count"] != numbers["watchlist_count"]


async def test_insight_and_stored_content_omit_quotes_and_alert_text(app, db):
    await insert_psych_record(
        db,
        student_id=LIN,
        record_date=date(2025, 3, 11),
        emotion_tag="焦虑",
        interaction_content=QUOTE,
        trigger_keywords=["结束"],
    )
    await insert_psych_profile(
        db,
        student_id=LIN,
        risk_level="high",
        latest_emotion_tag="焦虑",
        weekly_summary={"raw": QUOTE},
    )
    await insert_psych_alert(
        db,
        student_id=LIN,
        created=_at(date(2025, 3, 11)),
        status="pending",
        trigger_reason=ALERT_QUOTE,
    )

    report = await app.generate(KIND, WEEK_START)
    dumped = json.dumps(report.content, ensure_ascii=False)

    assert QUOTE not in dumped
    assert ALERT_QUOTE not in dumped
    risk = report.content["numbers"]["week_risk_students"][0]
    assert set(risk.keys()) == {"student_name", "risk_level", "emotion_tag"}
    assert risk["student_name"] == "林平磊"


async def test_insight_payload_omits_quotes_and_puts_week_risk_first(db):
    recorder = _RecordingInsight()
    app = ReportApplication(db=db, clock=FrozenClock(NOW), insight=recorder)
    await insert_psych_record(
        db,
        student_id=LIN,
        record_date=date(2025, 3, 11),
        interaction_content=QUOTE,
    )
    await insert_psych_profile(db, student_id=LIN, risk_level="high", latest_emotion_tag="低落")
    await insert_psych_profile(db, student_id=GAO, risk_level="medium", latest_emotion_tag="焦虑")
    await insert_psych_alert(
        db,
        student_id=LIN,
        created=_at(date(2025, 3, 11)),
        status="pending",
        trigger_reason=ALERT_QUOTE,
    )

    report = await app.generate(KIND, WEEK_START)
    dumped = json.dumps(recorder.payload, ensure_ascii=False)

    assert report.status == "completed"
    assert QUOTE not in dumped
    assert ALERT_QUOTE not in dumped
    assert recorder.payload["insight_detail"][0]["student_name"] == "林平磊"
    assert recorder.payload["insight_detail"][0]["risk_level"] == "high"


async def test_approaching_nodes_use_period_plus_minus_seven_days(app, db):
    await insert_academic_deadline(db, student_id=LIN, deadline=_at(date(2025, 3, 3)), title="窗口起点")
    await insert_academic_deadline(db, student_id=GAO, deadline=_at(date(2025, 3, 19)), title="窗口终点")
    await insert_academic_deadline(db, student_id=HU, deadline=_at(date(2025, 3, 2)), title="窗口外前")
    await insert_academic_deadline(
        db, student_id=LIN, deadline=_at(date(2025, 3, 20)), title="窗口外后"
    )

    report = await app.generate(KIND, WEEK_START)
    nodes = report.content["numbers"]["approaching_nodes"]
    titles = {item["title"] for item in nodes}

    assert "窗口起点" in titles
    assert "窗口终点" in titles
    assert "窗口外前" not in titles
    assert "窗口外后" not in titles
    assert {item["student_name"] for item in nodes} == {"林平磊", "高杰"}


async def test_no_approaching_nodes_leaves_the_list_empty(app, db):
    await insert_academic_deadline(db, student_id=LIN, deadline=_at(date(2025, 1, 1)), title="寒假考试")

    report = await app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["approaching_nodes"] == []
    assert "开学季" not in json.dumps(report.content, ensure_ascii=False)


async def test_generic_deadline_without_student_is_not_a_node(app, db):
    await insert_academic_deadline(db, student_id=None, deadline=_at(date(2025, 3, 11)), title="通用考试")

    report = await app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["approaching_nodes"] == []


async def test_watchlist_without_records_is_not_empty_insight(app, db):
    await insert_psych_profile(db, student_id=GAO, risk_level="medium", latest_emotion_tag="焦虑")

    report = await app.generate(KIND, WEEK_START)

    assert report.status == "completed"
    assert report.content["numbers"]["recorded_student_count"] == 0
    assert report.content["numbers"]["watchlist_count"] == 1
    assert "没有需要持续关注的学生" not in report.content["insight"]["watchlist_narrative"]
    assert report.content["insight"]["suggested_action"]


async def test_second_generate_replaces_previous_success_in_history(app):
    first = await app.generate(KIND, WEEK_START)
    second = await app.generate(KIND, WEEK_START)

    assert first.id != second.id
    current = await app.current(KIND, WEEK_START)
    assert current.id == second.id
    history = await app.history(KIND)
    same_period = [item for item in history if item.period_start == WEEK_START]
    assert [item.id for item in same_period] == [second.id]
    assert first.id not in [item.id for item in history]


async def test_insight_failure_does_not_replace_current_report(app, db):
    first = await app.generate(KIND, WEEK_START)
    failing = ReportApplication(
        db=db,
        clock=FrozenClock(NOW),
        insight=FailingInsightAdapter(),
    )

    failed = await failing.generate(KIND, WEEK_START)

    assert failed.status == "failed"
    assert failed.error_message
    current = await failing.current(KIND, WEEK_START)
    assert current.id == first.id
    assert current.status == "completed"


async def test_in_progress_week_ends_today_not_sunday(app):
    report = await app.generate(KIND, WEEK_START)

    assert report.period_start == date(2025, 3, 10)
    assert report.period_end == date(2025, 3, 12)


async def test_historical_week_is_monday_through_sunday(app):
    report = await app.generate(KIND, date(2025, 3, 3))

    assert report.period_start == date(2025, 3, 3)
    assert report.period_end == date(2025, 3, 9)


async def test_totals_stay_full_when_insight_detail_exceeds_fifty(app, db):
    for index in range(51):
        student_id = await insert_staff(db, username=f"psy_risk_{index}", real_name=f"风险生{index}", role_code="student")
        await insert_psych_alert(
            db,
            student_id=student_id,
            created=_at(date(2025, 3, 11), 10) + timedelta(minutes=index),
            status="pending",
        )

    report = await app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["week_risk_count"] == 51
    assert len(report.content["numbers"]["week_risk_students"]) == 51


async def test_insight_payload_caps_detail_and_puts_week_risk_first(db):
    recorder = _RecordingInsight()
    app = ReportApplication(db=db, clock=FrozenClock(NOW), insight=recorder)
    await insert_psych_profile(db, student_id=GAO, risk_level="medium", latest_emotion_tag="焦虑")
    for index in range(51):
        student_id = await insert_staff(
            db, username=f"psy_cap_{index}", real_name=f"风险生{index}", role_code="student"
        )
        await insert_psych_alert(
            db,
            student_id=student_id,
            created=_at(date(2025, 3, 11), 10) + timedelta(minutes=index),
            status="pending",
        )

    report = await app.generate(KIND, WEEK_START)
    detail = recorder.payload["insight_detail"]

    assert report.status == "completed"
    assert report.content["numbers"]["week_risk_count"] == 51
    assert report.content["numbers"]["watchlist_count"] == 1
    assert len(detail) == 50
    assert all("风险生" in item["student_name"] for item in detail)
    assert not any(item.get("student_name") == "高杰" for item in detail)


class _RecordingInsight:
    def __init__(self):
        self.payload = None

    def narrate(self, kind: str, numbers: dict) -> dict:
        self.payload = numbers
        return FixedInsightAdapter().narrate(kind, numbers)
