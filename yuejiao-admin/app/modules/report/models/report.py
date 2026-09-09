"""智能报告模块 ORM 模型。

对应《公用/表/05-智能报告.sql》中的 report_generation 表。
（report_schedule 定时任务表暂未在应用中使用，未建模。）
"""

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.mysql import JSON, MEDIUMTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReportGeneration(Base):
    """报告生成记录表（单条记录一次生成过程，status 从 generating → completed/failed）。"""

    __tablename__ = "report_generation"
    __table_args__ = (
        Index("idx_report_type", "report_type"),
        Index("idx_status", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    report_type: Mapped[str] = mapped_column(String(32), nullable=False)
    report_title: Mapped[str] = mapped_column(String(255), nullable=False)
    report_content: Mapped[dict | None] = mapped_column(JSON)
    report_html: Mapped[str | None] = mapped_column(MEDIUMTEXT)
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    generated_by: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="generating")
    error_message: Mapped[str | None] = mapped_column(Text)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
