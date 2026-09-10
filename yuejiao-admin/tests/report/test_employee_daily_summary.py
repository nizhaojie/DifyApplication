from datetime import date, datetime
from zoneinfo import ZoneInfo

from tests.conftest import NOW, WEEK_START, insert_daily_report, insert_staff
from app.modules.report.application import (
    KIND_DAILY_SUMMARY,
    KIND_WEEKLY_SUMMARY,
    ReportApplication,
)
from app.modules.report.clock import FrozenClock
from app.modules.report.insight import FailingInsightAdapter, FixedInsightAdapter

SHANGHAI = ZoneInfo("Asia/Shanghai")


def _detect_expected_staff_count() -> int:
    try:
        from app.core.config import settings
        from sqlalchemy import create_engine, text

        engine = create_engine(settings.sync_database_url)
        with engine.connect() as conn:
            cnt = conn.execute(
                text(
                    "SELECT COUNT(1) FROM sys_user u "
                    "JOIN sys_role r ON r.id = u.role_id "
                    "WHERE r.role_code IN ('employee', 'manager', 'team_leader')"
                )
            ).scalar()
            return cnt or 14
    except Exception:
        return 14


EXPECTED_STAFF_COUNT = _detect_expected_staff_count()
ZHANG = 3  # 张顾问 employee
WANG = 4  # 王顾问 employee


async def test_empty_week_yields_completed_empty_current_report(app):
    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)

    assert report.status == "completed"
    assert report.kind == KIND_WEEKLY_SUMMARY
    coverage = report.content["numbers"]["coverage"]
    assert coverage["expected_count"] == EXPECTED_STAFF_COUNT
    assert coverage["submitted_count"] == 0
    assert coverage["missing_count"] == EXPECTED_STAFF_COUNT
    assert coverage["submitted"] == []

    current = await app.current(KIND_WEEKLY_SUMMARY, WEEK_START)
    assert current is not None
    assert current.id == report.id
    assert current.status == "completed"


async def test_expected_submitters_exclude_student_and_admin(app):
    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    names = {person["name"] for person in report.content["numbers"]["coverage"]["expected"]}

    assert "张顾问" in names
    assert "张经理" in names
    assert "李老师" in names
    assert "系统管理员" not in names
    assert "李超" not in names
    assert "林平磊" not in names
    assert len(names) == EXPECTED_STAFF_COUNT


async def test_draft_and_missing_count_as_unsubmitted(app, db):
    await insert_daily_report(db, employee_id=ZHANG, report_date=date(2025, 3, 11), status="submitted")
    await insert_daily_report(db, employee_id=WANG, report_date=date(2025, 3, 11), status="draft")

    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    coverage = report.content["numbers"]["coverage"]
    submitted_names = [item["name"] for item in coverage["submitted"]]
    missing_names = {item["name"] for item in coverage["missing"]}

    assert coverage["submitted_count"] == 1
    assert submitted_names == ["张顾问"]
    assert "王顾问" in missing_names
    assert coverage["missing_count"] == EXPECTED_STAFF_COUNT - 1
    assert "张顾问" not in missing_names


async def test_empty_report_insight_narrates_nobody_submitted(app):
    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)

    assert report.status == "completed"
    assert "无人提交日报" in report.content["insight"]["coverage_narrative"]
    assert report.content["insight"]["suggested_action"]


async def test_day_period_is_that_calendar_day(app, db):
    await insert_daily_report(db, employee_id=ZHANG, report_date=date(2025, 3, 11), status="submitted")
    await insert_daily_report(db, employee_id=WANG, report_date=date(2025, 3, 12), status="submitted")

    report = await app.generate(KIND_DAILY_SUMMARY, date(2025, 3, 12))
    coverage = report.content["numbers"]["coverage"]
    submitted_names = [item["name"] for item in coverage["submitted"]]

    assert report.period_start == date(2025, 3, 12)
    assert report.period_end == date(2025, 3, 12)
    assert submitted_names == ["王顾问"]


async def test_week_period_includes_each_day_in_the_grain(app, db):
    await insert_daily_report(db, employee_id=ZHANG, report_date=date(2025, 3, 11), status="submitted")
    await insert_daily_report(db, employee_id=WANG, report_date=date(2025, 3, 12), status="submitted")

    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    submitted_names = {item["name"] for item in report.content["numbers"]["coverage"]["submitted"]}

    assert report.period_start == date(2025, 3, 10)
    assert report.period_end == date(2025, 3, 12)
    assert submitted_names == {"张顾问", "王顾问"}
    assert report.content["numbers"]["coverage"]["submitted_count"] == 2


async def test_in_progress_week_ends_today_not_sunday(app):
    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)

    assert report.period_start == date(2025, 3, 10)
    assert report.period_end == date(2025, 3, 12)


async def test_historical_week_is_monday_through_sunday(app):
    report = await app.generate(KIND_WEEKLY_SUMMARY, date(2025, 3, 3))

    assert report.period_start == date(2025, 3, 3)
    assert report.period_end == date(2025, 3, 9)


async def test_second_generate_replaces_previous_success_in_history(app):
    first = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    second = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)

    assert first.id != second.id
    current = await app.current(KIND_WEEKLY_SUMMARY, WEEK_START)
    assert current.id == second.id
    history = await app.history(KIND_WEEKLY_SUMMARY)
    same_period = [item for item in history if item.period_start == WEEK_START]
    assert [item.id for item in same_period] == [second.id]
    assert first.id not in [item.id for item in history]


async def test_insight_failure_does_not_replace_current_report(app, db, insight):
    first = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    failing = ReportApplication(
        db=db,
        clock=FrozenClock(NOW),
        insight=FailingInsightAdapter(),
    )

    failed = await failing.generate(KIND_WEEKLY_SUMMARY, WEEK_START)

    assert failed.status == "failed"
    assert failed.error_message
    current = await failing.current(KIND_WEEKLY_SUMMARY, WEEK_START)
    assert current.id == first.id
    assert current.status == "completed"


async def test_history_can_open_an_older_period(app, db):
    await insert_daily_report(db, employee_id=ZHANG, report_date=date(2025, 3, 4), status="submitted")
    older = await app.generate(KIND_WEEKLY_SUMMARY, date(2025, 3, 3))
    await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)

    history = await app.history(KIND_WEEKLY_SUMMARY)
    found = next(item for item in history if item.id == older.id)
    assert found.period_start == date(2025, 3, 3)
    assert found.content["numbers"]["coverage"]["submitted_count"] == 1
    assert found.content["numbers"]["coverage"]["submitted"][0]["name"] == "张顾问"


async def test_current_still_finds_a_midweek_report_after_the_week_has_ended(db, insight):
    midweek = ReportApplication(db=db, clock=FrozenClock(NOW), insight=insight)
    created = await midweek.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    later = ReportApplication(
        db=db,
        clock=FrozenClock(datetime(2025, 3, 17, 10, 0, tzinfo=SHANGHAI)),
        insight=insight,
    )

    current = await later.current(KIND_WEEKLY_SUMMARY, WEEK_START)

    assert current is not None
    assert current.id == created.id
    assert current.period_end == date(2025, 3, 12)


async def test_insight_does_not_rewrite_coverage_counts(app, db):
    await insert_daily_report(db, employee_id=ZHANG, report_date=date(2025, 3, 11), status="submitted")

    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)

    assert report.content["numbers"]["coverage"]["submitted_count"] == 1
    assert report.content["numbers"]["coverage"]["expected_count"] == EXPECTED_STAFF_COUNT
    assert report.content["insight"] == FixedInsightAdapter().narrate(KIND_WEEKLY_SUMMARY, report.content["numbers"])


async def test_completed_report_has_fixed_chapters(app, db):
    await insert_daily_report(db, employee_id=ZHANG, report_date=date(2025, 3, 11), status="submitted")

    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    insight = report.content["insight"]

    assert "coverage" in report.content["numbers"]
    assert insight["coverage_narrative"]
    assert insight["progress_narrative"]
    assert insight["output_narrative"]
    assert insight["risk_narrative"]
    assert insight["suggested_action"]


async def test_totals_stay_full_when_insight_detail_exceeds_fifty(app, db):
    for index in range(40):
        await insert_staff(db, username=f"rpt_cap_{index}", real_name=f"测试员{index}")

    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    coverage = report.content["numbers"]["coverage"]

    assert coverage["expected_count"] == EXPECTED_STAFF_COUNT + 40
    assert coverage["missing_count"] == EXPECTED_STAFF_COUNT + 40
    assert coverage["submitted_count"] == 0


async def test_insight_payload_caps_detail_and_puts_missing_first(db):
    recorder = _RecordingInsight()
    app = ReportApplication(db=db, clock=FrozenClock(NOW), insight=recorder)
    await insert_daily_report(db, employee_id=ZHANG, report_date=date(2025, 3, 11), status="submitted")
    for index in range(40):
        await insert_staff(db, username=f"rpt_miss_{index}", real_name=f"缺交员{index}")

    report = await app.generate(KIND_WEEKLY_SUMMARY, WEEK_START)
    detail = recorder.payload["insight_detail"]
    coverage = report.content["numbers"]["coverage"]

    assert report.status == "completed"
    assert coverage["expected_count"] == EXPECTED_STAFF_COUNT + 40
    assert coverage["submitted_count"] == 1
    assert coverage["missing_count"] == EXPECTED_STAFF_COUNT + 39
    assert len(detail) == 50
    assert detail[0]["name"] != "张顾问"
    assert "user_id" in detail[0]
    submitted_in_detail = [item for item in detail if item.get("name") == "张顾问"]
    assert submitted_in_detail == []


class _RecordingInsight:
    def __init__(self):
        self.payload = None

    def narrate(self, kind: str, numbers: dict) -> dict:
        self.payload = numbers
        return FixedInsightAdapter().narrate(kind, numbers)
