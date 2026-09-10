"""客户研判（Profile）模块 ORM 模型。

对应《公用/表/01-客户研判.sql》（源自 db_init.sql 第 72-126 行）三张表：

profile_rule      — 用户画像研判规则（产品线 + rule_content JSON + match_prompt）
customer_source   — 客户信息来源（text/pdf_resume/excel，原始内容 + 解析结果）
customer_profile  — 研判结果（match_result / matched_product / match_score / match_reason
                    / recommended_programs）
"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProfileRule(Base):
    """用户画像研判规则表。"""

    __tablename__ = "profile_rule"
    __table_args__ = (Index("ix_profile_rule_product_line", "product_line"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_line: Mapped[str] = mapped_column(String(64), nullable=False, comment="产品线")
    rule_name: Mapped[str] = mapped_column(String(128), nullable=False, comment="规则名称")
    rule_content: Mapped[dict] = mapped_column(
        JSON, nullable=False, comment="研判规则配置 JSON（学历/语言/年龄等条件）"
    )
    match_prompt: Mapped[str | None] = mapped_column(Text, comment="AI 研判使用的系统提示词")
    priority: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="优先级，数值越大越优先"
    )
    status: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=1, comment="状态 1=启用 0=禁用"
    )
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class CustomerSource(Base):
    """客户信息来源记录表（文本 / PDF 简历 / Excel 等）。"""

    __tablename__ = "customer_source"
    __table_args__ = (
        Index("ix_customer_source_source_type", "source_type"),
        Index("ix_customer_source_operator_id", "operator_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="text",
        comment="信息来源类型 text/pdf_resume/excel/import/manual",
    )
    raw_content: Mapped[str | None] = mapped_column(Text, comment="原始文本内容")
    file_url: Mapped[str | None] = mapped_column(String(512), comment="上传文件 URL")
    file_name: Mapped[str | None] = mapped_column(String(255), comment="原始文件名")
    parse_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", comment="解析状态 pending/success/failed"
    )
    parse_result: Mapped[dict | None] = mapped_column(JSON, comment="AI 解析后结构化结果")
    parse_error: Mapped[str | None] = mapped_column(Text, comment="解析失败原因")
    operator_id: Mapped[int | None] = mapped_column(Integer, comment="操作人 ID")
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class CustomerProfile(Base):
    """客户画像研判结果表。"""

    __tablename__ = "customer_profile"
    __table_args__ = (
        Index("ix_customer_profile_source_id", "source_id"),
        Index("ix_customer_profile_match_result", "match_result"),
        Index("ix_customer_profile_matched_product", "matched_product"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_name: Mapped[str | None] = mapped_column(String(64), comment="客户姓名")
    contact_info: Mapped[str | None] = mapped_column(String(128), comment="联系方式")
    source_id: Mapped[int | None] = mapped_column(Integer, comment="关联客户信息来源 ID")
    background_info: Mapped[dict | None] = mapped_column(JSON, comment="客户背景结构化数据")
    match_result: Mapped[str | None] = mapped_column(
        String(16), comment="匹配结果 matched/partial/not_matched"
    )
    matched_product: Mapped[str | None] = mapped_column(String(128), comment="匹配的产品线")
    match_score: Mapped[float | None] = mapped_column(Numeric(5, 2), comment="匹配度评分 0-100")
    match_reason: Mapped[str | None] = mapped_column(Text, comment="AI 研判原因说明")
    recommended_programs: Mapped[list | None] = mapped_column(
        JSON, comment="推荐的专业/项目列表"
    )
    evaluator_id: Mapped[int | None] = mapped_column(Integer, comment="研判人/操作人 ID")
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
