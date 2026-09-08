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
    Column,
    DateTime,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)

from app.db.base import Base


class ProfileRule(Base):
    """用户画像研判规则表。"""

    __tablename__ = "profile_rule"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_line = Column(String(64), nullable=False, index=True, comment="产品线")
    rule_name = Column(String(128), nullable=False, comment="规则名称")
    rule_content = Column(JSON, nullable=False, comment="研判规则配置 JSON（学历/语言/年龄等条件）")
    match_prompt = Column(Text, nullable=True, comment="AI 研判使用的系统提示词")
    priority = Column(Integer, nullable=False, default=0, comment="优先级，数值越大越优先")
    status = Column(SmallInteger, nullable=False, default=1, comment="状态 1=启用 0=禁用")
    create_time = Column(DateTime, nullable=False, default=datetime.now)
    update_time = Column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class CustomerSource(Base):
    """客户信息来源记录表（文本 / PDF 简历 / Excel 等）。"""

    __tablename__ = "customer_source"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_type = Column(
        String(32),
        nullable=False,
        default="text",
        index=True,
        comment="信息来源类型 text/pdf_resume/excel/import/manual",
    )
    raw_content = Column(Text, nullable=True, comment="原始文本内容")
    file_url = Column(String(512), nullable=True, comment="上传文件 URL")
    file_name = Column(String(255), nullable=True, comment="原始文件名")
    parse_status = Column(
        String(16),
        nullable=False,
        default="pending",
        index=True,
        comment="解析状态 pending/success/failed",
    )
    parse_result = Column(JSON, nullable=True, comment="AI 解析后结构化结果")
    parse_error = Column(Text, nullable=True, comment="解析失败原因")
    operator_id = Column(Integer, nullable=True, index=True, comment="操作人 ID")
    create_time = Column(DateTime, nullable=False, default=datetime.now)


class CustomerProfile(Base):
    """客户画像研判结果表。"""

    __tablename__ = "customer_profile"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_name = Column(String(64), nullable=True, comment="客户姓名")
    contact_info = Column(String(128), nullable=True, comment="联系方式")
    source_id = Column(Integer, nullable=True, index=True, comment="关联客户信息来源 ID")
    background_info = Column(JSON, nullable=True, comment="客户背景结构化数据")
    match_result = Column(
        String(16),
        nullable=True,
        index=True,
        comment="匹配结果 matched/partial/not_matched",
    )
    matched_product = Column(String(128), nullable=True, index=True, comment="匹配的产品线")
    match_score = Column(Numeric(5, 2), nullable=True, comment="匹配度评分 0-100")
    match_reason = Column(Text, nullable=True, comment="AI 研判原因说明")
    recommended_programs = Column(JSON, nullable=True, comment="推荐的专业/项目列表")
    evaluator_id = Column(Integer, nullable=True, comment="研判人/操作人 ID")
    create_time = Column(DateTime, nullable=False, default=datetime.now)
    update_time = Column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
