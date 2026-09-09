from sqlalchemy import BigInteger, DateTime, Integer, String, Text, SmallInteger, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StudentFeedbackTicket(Base):
    __tablename__ = "student_feedback_ticket"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(BigInteger)
    ticket_type: Mapped[str] = mapped_column(String(32), default="complaint")
    category: Mapped[str | None] = mapped_column(String(64))
    title: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    detail: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    assignee_id: Mapped[int | None] = mapped_column(BigInteger)
    solution: Mapped[str | None] = mapped_column(Text)
    satisfaction: Mapped[int | None] = mapped_column(SmallInteger)
    is_notified: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    update_time: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
