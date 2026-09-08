from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from tests.conftest import KIND, NOW, WEEK_START, insert_ticket
from app.modules.report.application import ReportApplication
from app.modules.report.clock import FrozenClock
from app.modules.report.insight import FailingInsightAdapter, FixedInsightAdapter

SHANGHAI = ZoneInfo("Asia/Shanghai")
LIN = 17  # 林平磊
GAO = 18  # 高杰
HU = 19  # 胡鑫伟


def _at(day: date, hour: int = 15, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=SHANGHAI)


def test_empty_period_yields_completed_empty_current_report(app):
    report = app.generate(KIND, WEEK_START)

    assert report.status == "completed"
    assert report.content["numbers"]["period_complaint_count"] == 0
    assert report.content["numbers"]["open_complaints"] == []
    assert report.content["numbers"]["wow"]["label"] == "样本不足"

    current = app.current(KIND, WEEK_START)
    assert current is not None
    assert current.id == report.id
    assert current.status == "completed"


def test_period_complaints_are_created_in_the_period_only(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 11)))
    insert_ticket(conn, student_id=GAO, created=_at(date(2025, 3, 1)), status="pending")

    report = app.generate(KIND, WEEK_START)
    numbers = report.content["numbers"]

    assert numbers["period_complaint_count"] == 1
    assert numbers["open_complaints"][0]["student_name"] == "高杰"


def test_suggestion_and_consult_are_not_period_complaints(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 11)), ticket_type="suggestion")
    insert_ticket(conn, student_id=GAO, created=_at(date(2025, 3, 11)), ticket_type="consult")

    report = app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["period_complaint_count"] == 0


def test_open_alert_requires_more_than_three_days(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 9), 15), status="pending")
    insert_ticket(conn, student_id=GAO, created=_at(date(2025, 3, 9), 14), status="pending")

    report = app.generate(KIND, WEEK_START)
    names = [item["student_name"] for item in report.content["numbers"]["open_complaints"]]

    assert names == ["高杰"]
    alert = report.content["numbers"]["open_complaints"][0]
    assert alert["category"] == "签证办理"
    assert alert["elapsed_days"] == 3.04


def test_empty_category_is_bucketed_as_other(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 11)), category=None)
    insert_ticket(conn, student_id=GAO, created=_at(date(2025, 3, 11)), category="")

    report = app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["categories"] == [{"name": "其他", "count": 2}]


def test_closed_handling_uses_last_update_minus_created(app, conn):
    created = _at(date(2025, 3, 11), 10)
    insert_ticket(
        conn,
        student_id=LIN,
        created=created,
        updated=created + timedelta(hours=6),
        status="resolved",
    )

    report = app.generate(KIND, WEEK_START)
    item = report.content["numbers"]["handling"]["items"][0]

    assert item["student_name"] == "林平磊"
    assert item["elapsed_days"] == 0.25


def test_open_handling_uses_period_end_minus_created(app, conn):
    insert_ticket(
        conn,
        student_id=LIN,
        created=_at(date(2025, 3, 11), 15),
        status="processing",
    )

    report = app.generate(KIND, WEEK_START)
    item = report.content["numbers"]["handling"]["items"][0]

    assert item["elapsed_days"] == 1.0


def test_no_ratings_is_unrated_not_zero(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 11)), satisfaction=None)
    insert_ticket(conn, student_id=GAO, created=_at(date(2025, 3, 11)), satisfaction=None)

    report = app.generate(KIND, WEEK_START)
    satisfaction = report.content["numbers"]["satisfaction"]

    assert satisfaction["label"] == "暂无评价"
    assert satisfaction["average"] is None
    assert satisfaction["unrated_count"] == 2
    assert satisfaction["rated_count"] == 0


def test_satisfaction_averages_rated_only(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 11)), satisfaction=5)
    insert_ticket(conn, student_id=GAO, created=_at(date(2025, 3, 11)), satisfaction=3)
    insert_ticket(conn, student_id=HU, created=_at(date(2025, 3, 11)), satisfaction=None)

    report = app.generate(KIND, WEEK_START)
    satisfaction = report.content["numbers"]["satisfaction"]

    assert satisfaction["label"] is None
    assert satisfaction["average"] == 4.0
    assert satisfaction["rated_count"] == 2
    assert satisfaction["unrated_count"] == 1


def test_wow_is_insufficient_when_prior_period_is_zero(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 11)))

    report = app.generate(KIND, WEEK_START)
    wow = report.content["numbers"]["wow"]

    assert wow["label"] == "样本不足"
    assert wow["prior_count"] == 0


def test_wow_compares_equal_length_prior_week(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 4)))
    insert_ticket(conn, student_id=GAO, created=_at(date(2025, 3, 11)))
    insert_ticket(conn, student_id=HU, created=_at(date(2025, 3, 11)))

    report = app.generate(KIND, WEEK_START)
    wow = report.content["numbers"]["wow"]

    assert wow["label"] is None
    assert wow["prior_count"] == 1
    assert wow["delta"] == 1


def test_yoy_is_insufficient_sample(app):
    report = app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["yoy"]["label"] == "样本不足"


def test_in_progress_week_ends_today_not_sunday(app):
    report = app.generate(KIND, WEEK_START)

    assert report.period_start == date(2025, 3, 10)
    assert report.period_end == date(2025, 3, 12)


def test_historical_week_is_monday_through_sunday(app):
    report = app.generate(KIND, date(2025, 3, 3))

    assert report.period_start == date(2025, 3, 3)
    assert report.period_end == date(2025, 3, 9)


def test_second_generate_appends_and_current_is_the_new_success(app):
    first = app.generate(KIND, WEEK_START)
    second = app.generate(KIND, WEEK_START)

    assert first.id != second.id
    current = app.current(KIND, WEEK_START)
    assert current.id == second.id
    history_ids = [item.id for item in app.history(KIND)]
    assert first.id in history_ids
    assert second.id in history_ids


def test_insight_failure_does_not_replace_current_report(app, conn, insight):
    first = app.generate(KIND, WEEK_START)
    failing = ReportApplication(
        conn=conn,
        clock=FrozenClock(NOW),
        insight=FailingInsightAdapter(),
    )

    failed = failing.generate(KIND, WEEK_START)

    assert failed.status == "failed"
    assert failed.error_message
    current = failing.current(KIND, WEEK_START)
    assert current.id == first.id
    assert current.status == "completed"


def test_history_can_open_an_older_period(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 4)))
    older = app.generate(KIND, date(2025, 3, 3))
    app.generate(KIND, WEEK_START)

    found = next(item for item in app.history(KIND) if item.id == older.id)
    assert found.period_start == date(2025, 3, 3)
    assert found.content["numbers"]["period_complaint_count"] == 1


def test_current_still_finds_a_midweek_report_after_the_week_has_ended(conn, insight):
    midweek = ReportApplication(conn=conn, clock=FrozenClock(NOW), insight=insight)
    created = midweek.generate(KIND, WEEK_START)
    later = ReportApplication(
        conn=conn,
        clock=FrozenClock(datetime(2025, 3, 17, 10, 0, tzinfo=SHANGHAI)),
        insight=insight,
    )

    current = later.current(KIND, WEEK_START)

    assert current is not None
    assert current.id == created.id
    assert current.period_end == date(2025, 3, 12)


def test_insight_does_not_rewrite_counts(app, conn):
    insert_ticket(conn, student_id=LIN, created=_at(date(2025, 3, 11)))
    insert_ticket(conn, student_id=GAO, created=_at(date(2025, 3, 11)))

    report = app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["period_complaint_count"] == 2
    assert "insight" in report.content
    assert report.content["insight"] == FixedInsightAdapter().narrate(KIND, {})


def test_totals_stay_full_when_more_than_fifty_complaints(app, conn):
    for offset in range(51):
        insert_ticket(
            conn,
            student_id=LIN,
            created=_at(date(2025, 3, 11), 10) + timedelta(minutes=offset),
        )

    report = app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["period_complaint_count"] == 51
    assert len(report.content["numbers"]["handling"]["items"]) == 51

