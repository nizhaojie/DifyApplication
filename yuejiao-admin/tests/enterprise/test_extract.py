from app.integrations.nl2sql.guard import SqlGuardError, assert_readonly_sql
from app.modules.enterprise.services.memory import apply_context
from app.modules.enterprise.services.lead.extract import extract_daily_from_text, extract_lead_from_text, extract_person_name, guess_person_name
import pytest


def test_extract_lead():
    data = extract_lead_from_text("张三 13800138000 想咨询美国硕士", 1)
    assert data["customer_name"] == "张三"
    assert data["contact_info"] == "13800138000"
    assert data["intended_country"] == "美国"
    assert data["owner_employee_id"] == 1


def test_extract_leave_name():
    assert extract_person_name("同意张三的请假") == "张三"


def test_extract_status_name():
    assert extract_person_name("把李四改成已签约") == "李四"


def test_daily_split():
    data = extract_daily_from_text("今天跟了李四，进展：约了周六面谈。问题：预算还没定。计划：明天再打一次。")
    assert data["key_progress"]
    assert data["risks"]
    assert "明天" in (data["next_plan"] or "")


def test_sql_guard_blocks_write():
    with pytest.raises(SqlGuardError):
        assert_readonly_sql("DELETE FROM crm_lead")


def test_sql_guard_whitelist():
    with pytest.raises(SqlGuardError):
        assert_readonly_sql("SELECT * FROM mysql.user")


def test_sql_guard_adds_limit():
    sql = assert_readonly_sql("SELECT id FROM crm_lead")
    assert "LIMIT 50" in sql.upper()


def test_guess_lead_name():
    assert guess_person_name("张三 13800138000 想咨询美国硕士") == "张三"
    assert guess_person_name("公司简称是什么？") is None


def test_memory_pronoun():
    rewritten = apply_context("他的电话是多少？", ["张三 13800138000 想咨询美国硕士"])
    assert rewritten.startswith("查一下张三")
