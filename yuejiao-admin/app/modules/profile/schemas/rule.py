"""研判规则（产品线）管理出入参模型。

rule_content 结构与 RuleEngine 的约定一致（见 services/rule_engine.py 模块注释）：

    conditions[]  打分条件（field/op/value/weight/label）
    thresholds    matched/partial 两档阈值
    program_map[] 细分专业映射（match → programs）

校验目标：把「字段拼错 / 算子写错 / 阈值倒挂」挡在保存之前，
而不是等研判时被规则引擎静默当成不命中。
"""

from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.profile.schemas.profile import CustomerProfile
from app.modules.profile.services.rule_engine import ALLOWED_OPS

# 条件字段必须真实存在于 CustomerProfile（rule_engine 用 getattr 取值）
PROFILE_FIELDS = set(CustomerProfile.model_fields)
# program_map.match 额外允许的年龄区间键（rule_engine._match_program 特判）
PROGRAM_MATCH_FIELDS = PROFILE_FIELDS | {"age_min", "age_max"}

_LIST_OPS = ("in", "not_in", "contains_any", "not_contains_any")


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


class RuleCondition(BaseModel):
    field: str
    op: str
    value: Any = None
    weight: float = Field(default=0, ge=0, le=100)
    label: str | None = None

    @field_validator("field")
    @classmethod
    def _check_field(cls, value: str) -> str:
        if value not in PROFILE_FIELDS:
            raise ValueError(f"未知画像字段 {value}，可选：{'、'.join(sorted(PROFILE_FIELDS))}")
        return value

    @field_validator("op")
    @classmethod
    def _check_op(cls, value: str) -> str:
        if value not in ALLOWED_OPS:
            raise ValueError(f"未知算子 {value}，可选：{'、'.join(ALLOWED_OPS)}")
        return value

    @model_validator(mode="after")
    def _check_value_shape(self) -> "RuleCondition":
        if self.op == "between":
            if not isinstance(self.value, (list, tuple)) or len(self.value) != 2 or not all(_is_number(v) for v in self.value):
                raise ValueError("between 算子的 value 必须是 [下限, 上限] 数字区间")
        elif self.op in ("gte", "lte"):
            if not _is_number(self.value):
                raise ValueError(f"{self.op} 算子的 value 必须是数字")
        elif self.op in _LIST_OPS:
            if not isinstance(self.value, list) or not self.value:
                raise ValueError(f"{self.op} 算子的 value 必须是非空数组")
        # truthy / eq 不约束 value 形状
        return self


class RuleThresholds(BaseModel):
    matched: float = Field(default=60, ge=0, le=100)
    partial: float = Field(default=40, ge=0, le=100)

    @model_validator(mode="after")
    def _check_order(self) -> "RuleThresholds":
        if self.partial > self.matched:
            raise ValueError("partial 阈值不能高于 matched 阈值")
        return self


class ProgramMapEntry(BaseModel):
    match: dict[str, Any]
    programs: list[str] = Field(default_factory=list)
    category: str | None = None
    rationale: str | None = None

    @field_validator("match")
    @classmethod
    def _check_match_keys(cls, value: dict[str, Any]) -> dict[str, Any]:
        unknown = set(value) - PROGRAM_MATCH_FIELDS
        if unknown:
            raise ValueError(f"match 含未知字段 {'、'.join(sorted(unknown))}")
        return value


class RuleContent(BaseModel):
    conditions: list[RuleCondition] = Field(default_factory=list)
    thresholds: RuleThresholds = Field(default_factory=RuleThresholds)
    program_map: list[ProgramMapEntry] = Field(default_factory=list)


class RuleIn(BaseModel):
    """新增规则。"""

    product_line: str = Field(min_length=1, max_length=64)
    rule_name: str = Field(min_length=1, max_length=128)
    rule_content: RuleContent
    match_prompt: str | None = None
    priority: int = Field(default=0, ge=-999, le=999)
    status: int = Field(default=1, ge=0, le=1)


class RuleUpdate(BaseModel):
    """更新规则（部分更新，仅接收显式传入的字段）。"""

    product_line: str | None = Field(default=None, min_length=1, max_length=64)
    rule_name: str | None = Field(default=None, min_length=1, max_length=128)
    rule_content: RuleContent | None = None
    match_prompt: str | None = None
    priority: int | None = Field(default=None, ge=-999, le=999)
    status: int | None = Field(default=None, ge=0, le=1)


class RuleStatusIn(BaseModel):
    """启停切换入参。"""

    status: int = Field(ge=0, le=1)


class RuleOut(BaseModel):
    """规则列表 / 详情出参。"""

    id: int
    product_line: str
    rule_name: str
    rule_content: dict
    match_prompt: str | None = None
    priority: int
    status: int
    create_time: str | None = None
    update_time: str | None = None
