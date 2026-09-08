from sqlalchemy import BigInteger, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TodoItem(Base):
    __tablename__ = "todo_item"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    assignee_id: Mapped[int] = mapped_column(BigInteger)
    todo_type: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    related_type: Mapped[str | None] = mapped_column(String(64))
    related_id: Mapped[int | None] = mapped_column(BigInteger)
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    due_time: Mapped[object | None] = mapped_column(DateTime)
    completed_time: Mapped[object | None] = mapped_column(DateTime)
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    update_time: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
