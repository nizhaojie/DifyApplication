from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StudentAdminService(Base):
    __tablename__ = "student_admin_service"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(BigInteger)
    service_type: Mapped[str] = mapped_column(String(32))
    leave_type: Mapped[str | None] = mapped_column(String(32))
    start_time: Mapped[object | None] = mapped_column(DateTime)
    end_time: Mapped[object | None] = mapped_column(DateTime)
    reason: Mapped[str] = mapped_column(Text)
    attachment_url: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    approver_id: Mapped[int | None] = mapped_column(BigInteger)
    approval_comment: Mapped[str | None] = mapped_column(String(512))
    approval_time: Mapped[object | None] = mapped_column(DateTime)
    related_academic_id: Mapped[int | None] = mapped_column(BigInteger)
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    update_time: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
