from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from tests.conftest import NOW, WEEK_START, insert_customer_profile, insert_follow_up, insert_lead
from app.modules.report.application import ReportApplication
from app.modules.report.clock import FrozenClock
from app.modules.report.insight import FailingInsightAdapter, FixedInsightAdapter

KIND = "customer_ops"
FORBIDDEN_FLOW_FIELDS = (
    "new_signed",
    "new_lost",
    "signed_this_week",
    "lost_this_week",
    "new_signed_count",
    "new_lost_count",
)


def test_empty_period_yields_completed_empty_current_report(app):
    report = app.generate(KIND, WEEK_START)

    assert report.status == "completed"
    assert report.kind == KIND
    numbers = report.content["numbers"]
    assert numbers["intent_count"] == 0
    assert numbers["signed_count"] == 0
    assert numbers["lost_count"] == 0
    assert numbers["new_intent_count"] == 0
    assert numbers["intent"]["customers"] == []
    assert numbers["intent"]["new_intent"] == []
    assert numbers["intent"]["churn_warnings"] == []
    assert numbers["signed"]["customers"] == []
    assert numbers["lost"]["customers"] == []
    assert numbers["wow"]["label"] == "样本不足"
    assert numbers["yoy"]["label"] == "样本不足"
    for field in FORBIDDEN_FLOW_FIELDS:
        assert field not in numbers

    current = app.current(KIND, WEEK_START)
    assert current is not None
    assert current.id == report.id
    assert current.status == "completed"


def test_empty_report_insight_narrates_nobody_in_funnel(app):
    report = app.generate(KIND, WEEK_START)

    assert report.status == "completed"
    assert "没有进入漏斗" in report.content["insight"]["overview_narrative"] or (
        "客群人数为零" in report.content["insight"]["overview_narrative"]
    )
    assert report.content["insight"]["suggested_action"]


SHANGHAI = ZoneInfo("Asia/Shanghai")


def _at(day: date, hour: int = 15, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=SHANGHAI)


def _names(rows: list[dict]) -> set[str]:
    return {item["name"] for item in rows}


def test_cohorts_are_period_end_stock_not_weekly_flow(app, conn):
    insert_lead(conn, customer_name="陈意向", created=_at(date(2025, 2, 1)), status="new")
    insert_lead(conn, customer_name="周跟进", created=_at(date(2025, 2, 10)), status="contacting")
    insert_lead(conn, customer_name="吴合格", created=_at(date(2025, 1, 20)), status="qualified")
    insert_lead(conn, customer_name="郑成交", created=_at(date(2025, 1, 5)), status="signed")
    insert_lead(conn, customer_name="冯流失", created=_at(date(2025, 1, 8)), status="lost")

    report = app.generate(KIND, WEEK_START)
    numbers = report.content["numbers"]

    assert numbers["intent_count"] == 3
    assert _names(numbers["intent"]["customers"]) == {"陈意向", "周跟进", "吴合格"}
    assert numbers["signed_count"] == 1
    assert _names(numbers["signed"]["customers"]) == {"郑成交"}
    assert numbers["lost_count"] == 1
    assert _names(numbers["lost"]["customers"]) == {"冯流失"}
    assert numbers["new_intent_count"] == 0
    for field in FORBIDDEN_FLOW_FIELDS:
        assert field not in numbers
        assert field not in numbers["intent"]
        assert field not in numbers["signed"]
        assert field not in numbers["lost"]


def test_profile_not_in_funnel_is_in_no_cohort(app, conn):
    insert_customer_profile(conn, customer_name="研判未进漏斗")
    insert_lead(conn, customer_name="陈意向", created=_at(date(2025, 2, 1)), status="new")

    report = app.generate(KIND, WEEK_START)
    dumped_names = (
        _names(report.content["numbers"]["intent"]["customers"])
        | _names(report.content["numbers"]["signed"]["customers"])
        | _names(report.content["numbers"]["lost"]["customers"])
        | _names(report.content["numbers"]["intent"]["new_intent"])
    )

    assert "研判未进漏斗" not in dumped_names
    assert dumped_names == {"陈意向"}


def test_new_intent_uses_funnel_entry_in_period(app, conn):
    insert_lead(conn, customer_name="本期新人", created=_at(date(2025, 3, 11)), status="new")
    insert_lead(conn, customer_name="本期已签", created=_at(date(2025, 3, 10)), status="signed")
    insert_lead(conn, customer_name="上月老人", created=_at(date(2025, 2, 1)), status="contacting")
    insert_lead(conn, customer_name="期后进入", created=_at(date(2025, 3, 20)), status="new")

    report = app.generate(KIND, WEEK_START)
    numbers = report.content["numbers"]
    new_names = _names(numbers["intent"]["new_intent"])

    assert numbers["new_intent_count"] == 2
    assert new_names == {"本期新人", "本期已签"}
    assert "上月老人" not in new_names
    assert "期后进入" not in new_names
    assert numbers["intent_count"] == 2
    assert _names(numbers["intent"]["customers"]) == {"本期新人", "上月老人"}
    assert "期后进入" not in _names(numbers["intent"]["customers"])


def test_wow_is_insufficient_when_prior_new_intent_is_zero(app, conn):
    insert_lead(conn, customer_name="本期新人", created=_at(date(2025, 3, 11)), status="new")

    report = app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["wow"]["label"] == "样本不足"
    assert report.content["numbers"]["wow"]["prior_count"] == 0
    assert report.content["numbers"]["yoy"]["label"] == "样本不足"


def test_wow_compares_equal_length_prior_period(app, conn):
    insert_lead(conn, customer_name="上期一人", created=_at(date(2025, 3, 4)), status="qualified")
    insert_lead(conn, customer_name="本期甲", created=_at(date(2025, 3, 11)), status="new")
    insert_lead(conn, customer_name="本期乙", created=_at(date(2025, 3, 12)), status="new")
    insert_lead(conn, customer_name="上期周后", created=_at(date(2025, 3, 8)), status="new")

    report = app.generate(KIND, WEEK_START)
    wow = report.content["numbers"]["wow"]

    assert wow["label"] is None
    assert wow["prior_count"] == 1
    assert wow["delta"] == 1


def test_churn_warning_is_intent_stalled_fourteen_days(app, conn):
    insert_lead(
        conn,
        customer_name="满十四天",
        created=_at(date(2025, 1, 1)),
        status="contacting",
        last_contact=_at(date(2025, 2, 26)),
    )
    insert_lead(
        conn,
        customer_name="未满十四天",
        created=_at(date(2025, 1, 1)),
        status="new",
        last_contact=_at(date(2025, 2, 27)),
    )
    insert_lead(
        conn,
        customer_name="已成交不算预警",
        created=_at(date(2025, 1, 1)),
        status="signed",
        last_contact=_at(date(2025, 2, 1)),
    )
    insert_lead(
        conn,
        customer_name="已流失不算预警",
        created=_at(date(2025, 1, 1)),
        status="lost",
        last_contact=_at(date(2025, 2, 1)),
    )

    report = app.generate(KIND, WEEK_START)
    warnings = report.content["numbers"]["intent"]["churn_warnings"]

    assert _names(warnings) == {"满十四天"}
    assert warnings[0]["last_contact_on"] == "2025-02-26"
    assert warnings[0]["stalled_days"] == 14.0


def test_follow_up_refreshes_last_contact_for_churn_warning(app, conn):
    stale = insert_lead(
        conn,
        customer_name="跟进刷新",
        created=_at(date(2025, 1, 1)),
        status="qualified",
        last_contact=_at(date(2025, 2, 1)),
    )
    insert_follow_up(conn, lead_id=stale, created=_at(date(2025, 3, 10)))
    insert_lead(
        conn,
        customer_name="仍停滞",
        created=_at(date(2025, 1, 1)),
        status="new",
        last_contact=_at(date(2025, 2, 20)),
    )
    insert_lead(
        conn,
        customer_name="用进漏斗日",
        created=_at(date(2025, 2, 20)),
        status="new",
        last_contact=None,
    )

    report = app.generate(KIND, WEEK_START)
    warnings = report.content["numbers"]["intent"]["churn_warnings"]

    assert "跟进刷新" not in _names(warnings)
    assert "仍停滞" in _names(warnings)
    assert "用进漏斗日" in _names(warnings)
    fallback = next(item for item in warnings if item["name"] == "用进漏斗日")
    assert fallback["last_contact_on"] == "2025-02-20"


def test_intent_feature_groups_use_country_education_channel(app, conn):
    insert_lead(
        conn,
        customer_name="英本线上",
        created=_at(date(2025, 2, 1)),
        status="new",
        intended_country="英国",
        education_level="本科",
        source_channel="线上广告",
    )
    insert_lead(
        conn,
        customer_name="英美硕转介绍",
        created=_at(date(2025, 2, 2)),
        status="contacting",
        intended_country="英国,美国",
        education_level="硕士",
        source_channel="转介绍",
    )
    insert_lead(
        conn,
        customer_name="空字段",
        created=_at(date(2025, 2, 3)),
        status="qualified",
        intended_country=None,
        education_level=None,
        source_channel="",
    )

    report = app.generate(KIND, WEEK_START)
    groups = report.content["numbers"]["intent"]["feature_groups"]

    assert {"name": "英国", "count": 2} in groups["intended_country"]
    assert {"name": "美国", "count": 1} in groups["intended_country"]
    assert {"name": "其他", "count": 1} in groups["intended_country"]
    assert {"name": "本科", "count": 1} in groups["education_level"]
    assert {"name": "硕士", "count": 1} in groups["education_level"]
    assert {"name": "其他", "count": 1} in groups["education_level"]
    assert {"name": "线上广告", "count": 1} in groups["source_channel"]
    assert {"name": "转介绍", "count": 1} in groups["source_channel"]
    assert {"name": "其他", "count": 1} in groups["source_channel"]


def test_signed_high_value_features_use_same_dimensions(app, conn):
    insert_lead(
        conn,
        customer_name="唯一成交",
        created=_at(date(2025, 1, 5)),
        status="signed",
        intended_country="加拿大",
        education_level="本科",
        source_channel="展会",
    )

    report = app.generate(KIND, WEEK_START)
    groups = report.content["numbers"]["signed"]["feature_groups"]

    assert groups["intended_country"] == [{"name": "加拿大", "count": 1}]
    assert groups["education_level"] == [{"name": "本科", "count": 1}]
    assert groups["source_channel"] == [{"name": "展会", "count": 1}]
    assert "样本不足以归纳共性" in report.content["insight"]["signed_narrative"]


def test_conversion_path_is_follow_up_timeline_plus_status(app, conn):
    lead_id = insert_lead(
        conn,
        customer_name="成交路径",
        created=_at(date(2025, 1, 5)),
        status="signed",
    )
    insert_follow_up(conn, lead_id=lead_id, created=_at(date(2025, 2, 1), 10), content="首次电话了解预算")
    insert_follow_up(conn, lead_id=lead_id, created=_at(date(2025, 3, 11), 11), content="当面确认签约材料")
    insert_follow_up(conn, lead_id=lead_id, created=_at(date(2025, 3, 20), 11), content="周期后不应进入路径")

    report = app.generate(KIND, WEEK_START)
    path = report.content["numbers"]["signed"]["conversion_paths"][0]

    assert path["name"] == "成交路径"
    assert path["status"] == "signed"
    assert [item["content"] for item in path["follow_ups"]] == [
        "首次电话了解预算",
        "当面确认签约材料",
    ]
    dumped = str(report.content)
    assert "周期后不应进入路径" not in dumped
    assert "new" not in [item.get("status") for item in path["follow_ups"]]


def test_lost_attribution_uses_recorded_reason(app, conn):
    insert_lead(
        conn,
        customer_name="价格流失",
        created=_at(date(2025, 1, 8)),
        status="lost",
        lost_reason="价格原因",
    )
    insert_lead(
        conn,
        customer_name="原因空",
        created=_at(date(2025, 1, 9)),
        status="lost",
        lost_reason=None,
    )

    report = app.generate(KIND, WEEK_START)
    lost = {item["name"]: item["lost_reason"] for item in report.content["numbers"]["lost"]["customers"]}

    assert lost["价格流失"] == "价格原因"
    assert lost["原因空"] == ""
    assert report.content["insight"]["lost_narrative"]
    assert report.content["insight"]["suggested_action"]


def test_second_generate_replaces_previous_success_in_history(app):
    first = app.generate(KIND, WEEK_START)
    second = app.generate(KIND, WEEK_START)

    assert first.id != second.id
    current = app.current(KIND, WEEK_START)
    assert current.id == second.id
    history = app.history(KIND)
    same_period = [item for item in history if item.period_start == WEEK_START]
    assert [item.id for item in same_period] == [second.id]
    assert first.id not in [item.id for item in history]


def test_insight_failure_does_not_replace_current_report(app, conn):
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


def test_in_progress_week_ends_today_not_sunday(app):
    report = app.generate(KIND, WEEK_START)

    assert report.period_start == date(2025, 3, 10)
    assert report.period_end == date(2025, 3, 12)


def test_historical_week_is_monday_through_sunday(app):
    report = app.generate(KIND, date(2025, 3, 3))

    assert report.period_start == date(2025, 3, 3)
    assert report.period_end == date(2025, 3, 9)


def test_totals_stay_full_when_insight_detail_exceeds_fifty(app, conn):
    for index in range(51):
        insert_lead(
            conn,
            customer_name=f"预警客{index:02d}",
            created=_at(date(2025, 1, 1)) + timedelta(minutes=index),
            status="new",
            last_contact=_at(date(2025, 2, 1)),
        )

    report = app.generate(KIND, WEEK_START)

    assert report.content["numbers"]["intent_count"] == 51
    assert len(report.content["numbers"]["intent"]["churn_warnings"]) == 51
    assert report.content["numbers"]["new_intent_count"] == 0


def test_insight_payload_caps_detail_and_puts_churn_warnings_first(conn):
    recorder = _RecordingInsight()
    app = ReportApplication(conn=conn, clock=FrozenClock(NOW), insight=recorder)
    insert_lead(conn, customer_name="本期新人", created=_at(date(2025, 3, 11)), status="new")
    for index in range(51):
        insert_lead(
            conn,
            customer_name=f"预警客{index:02d}",
            created=_at(date(2025, 1, 1)) + timedelta(minutes=index),
            status="contacting",
            last_contact=_at(date(2025, 2, 1)),
        )

    report = app.generate(KIND, WEEK_START)
    detail = recorder.payload["insight_detail"]

    assert report.status == "completed"
    assert report.content["numbers"]["intent_count"] == 52
    assert report.content["numbers"]["new_intent_count"] == 1
    assert len(detail) == 50
    assert all("预警客" in item["name"] for item in detail)
    assert not any(item.get("name") == "本期新人" for item in detail)


class _RecordingInsight:
    def __init__(self):
        self.payload = None

    def narrate(self, kind: str, numbers: dict) -> dict:
        self.payload = numbers
        return FixedInsightAdapter().narrate(kind, numbers)
