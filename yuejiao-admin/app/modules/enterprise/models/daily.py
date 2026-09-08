from sqlalchemy import JSON, BigInteger, Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EmployeeDailyReport(Base):
    __tablename__ = "employee_daily_report"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(BigInteger)
    report_date: Mapped[object] = mapped_column(Date)
    raw_content: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    key_progress: Mapped[object | None] = mapped_column(JSON)
    risks: Mapped[object | None] = mapped_column(JSON)
    next_plan: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
