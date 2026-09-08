"""结构化客户画像。

extract 工作流产出的结构化结果，也是 rule_engine 消费的输入。
字段尽量规范化为枚举/布尔，使规则可用通用算子评估。
"""

from pydantic import BaseModel, Field


class LanguageItem(BaseModel):
    lang: str                      # 英语/德语/...
    level: str | None = None       # 雅思5.0 / B1 / 四级 / 流利 / 中等 ...


class CustomerProfile(BaseModel):
    # 基本属性
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    education_level: str | None = None     # 初中/高中/中职中技/大专/本科/硕士/博士
    education_raw: str | None = None
    location: str | None = None
    # 经济
    income_level: str | None = None        # 低/中/高/很高
    income_rank: int | None = None         # 1 低 / 2 中 / 3 高 / 4 很高
    income_raw: str | None = None
    # 语言
    language: list[LanguageItem] = Field(default_factory=list)
    de_qualified: bool | None = None        # 德语 B1+ 或强学习意愿（中德用）
    # 需求与意向
    core_demand: str | None = None
    needs: list[str] = Field(default_factory=list)      # 升学/就业/移民/学历提升/落户/转换赛道/子女教育
    intended_country: str | None = None    # 德国/新加坡/...
    # 能力与态度（由 tags/skills 推断）
    hands_on: bool | None = None            # 动手能力强
    logic_strong: bool | None = None
    learning_attitude: bool | None = None  # 接受线下封闭实训 / 学习毅力
    background_keywords: list[str] = Field(default_factory=list)  # 机电/汽车/IT/护理/建筑...
    # 原始
    summary: str | None = None
    tags: dict = Field(default_factory=dict)
