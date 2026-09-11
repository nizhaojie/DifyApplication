"""设置页 · 研判规则（产品线）管理服务测试。

复用 conftest 的 db 夹具（外部事务 + 回滚），直接打服务层。
"""

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.profile.schemas.rule import RuleIn, RuleUpdate
from app.modules.profile.services.rule_admin import RuleAdminService
from app.modules.profile.services.rule_engine import RuleEngine


def _content(**overrides) -> dict:
    content = {
        "conditions": [
            {"field": "age", "op": "between", "value": [18, 35], "weight": 10, "label": "年龄18-35"},
        ],
        "thresholds": {"matched": 60, "partial": 40},
        "program_map": [
            {"match": {"education_level": ["大专"]}, "programs": ["测试专业"], "category": "测试类", "rationale": "对口"},
        ],
    }
    content.update(overrides)
    return content


def _rule_in(product_line="测试产品线A", **kwargs) -> RuleIn:
    payload = {
        "product_line": product_line,
        "rule_name": f"{product_line} · 规则",
        "rule_content": _content(),
        "match_prompt": "你是研判顾问。",
        "priority": 5,
        "status": 1,
    }
    payload.update(kwargs)
    return RuleIn(**payload)


async def test_create_and_get_roundtrip(db: AsyncSession):
    svc = RuleAdminService(db)
    rule = await svc.create_rule(_rule_in())

    assert rule.id is not None
    fetched = await svc.get_rule(rule.id)
    assert fetched.product_line == "测试产品线A"
    assert fetched.rule_content["thresholds"] == {"matched": 60, "partial": 40}
    assert fetched.rule_content["program_map"][0]["programs"] == ["测试专业"]


async def test_list_rules_filter_by_status_and_product_line(db: AsyncSession):
    svc = RuleAdminService(db)
    enabled = await svc.create_rule(_rule_in("列表产品线-启用"))
    await svc.create_rule(_rule_in("列表产品线-禁用", status=0))

    by_line = await svc.list_rules(product_line="列表产品线-启用")
    assert [r.id for r in by_line] == [enabled.id]

    disabled = await svc.list_rules(status=0, product_line="列表产品线-禁用")
    assert len(disabled) == 1


async def test_update_rule_partial(db: AsyncSession):
    svc = RuleAdminService(db)
    rule = await svc.create_rule(_rule_in())

    updated = await svc.update_rule(
        rule.id,
        RuleUpdate(rule_name="改名后的规则", rule_content=_content(thresholds={"matched": 80, "partial": 50})),
    )
    assert updated.rule_name == "改名后的规则"
    assert updated.rule_content["thresholds"] == {"matched": 80, "partial": 50}
    assert updated.match_prompt == "你是研判顾问。"  # 未传字段不动
    assert updated.product_line == "测试产品线A"

    # 显式清空 match_prompt
    cleared = await svc.update_rule(rule.id, RuleUpdate(match_prompt=None))
    assert cleared.match_prompt is None


async def test_update_missing_rule_returns_none(db: AsyncSession):
    svc = RuleAdminService(db)
    assert await svc.update_rule(999999, RuleUpdate(priority=1)) is None


async def test_disabled_rule_excluded_from_engine(db: AsyncSession):
    svc = RuleAdminService(db)
    rule = await svc.create_rule(_rule_in("启停产品线"))

    loaded = await RuleEngine.load(db)
    assert any(r.id == rule.id for r in loaded.rules)

    await svc.set_status(rule.id, 0)
    loaded = await RuleEngine.load(db)
    assert not any(r.id == rule.id for r in loaded.rules)


async def test_delete_rule(db: AsyncSession):
    svc = RuleAdminService(db)
    rule = await svc.create_rule(_rule_in("待删除产品线"))

    assert await svc.delete_rule(rule.id) is True
    assert await svc.get_rule(rule.id) is None
    assert await svc.delete_rule(rule.id) is False


# ---------- rule_content 校验 ----------


def test_reject_unknown_op():
    with pytest.raises(ValidationError, match="未知算子"):
        _rule_in(rule_content=_content(conditions=[{"field": "age", "op": ">", "value": 18}]))


def test_reject_unknown_field():
    with pytest.raises(ValidationError, match="未知画像字段"):
        _rule_in(rule_content=_content(conditions=[{"field": "hight", "op": "gte", "value": 170}]))


def test_reject_bad_between_value():
    with pytest.raises(ValidationError, match="between"):
        _rule_in(rule_content=_content(conditions=[{"field": "age", "op": "between", "value": [18]}]))


def test_reject_thresholds_crossed():
    with pytest.raises(ValidationError, match="partial"):
        _rule_in(rule_content=_content(thresholds={"matched": 40, "partial": 60}))


def test_reject_unknown_program_match_key():
    with pytest.raises(ValidationError, match="match 含未知字段"):
        _rule_in(rule_content=_content(program_map=[{"match": {"hight": ["高"]}, "programs": ["x"]}]))


def test_age_min_max_allowed_in_program_match():
    payload = _rule_in(
        rule_content=_content(
            program_map=[{"match": {"education_level": ["中职中技"], "age_min": 17}, "programs": ["酒店运营"]}]
        )
    )
    assert payload.rule_content.program_map[0].match["age_min"] == 17
