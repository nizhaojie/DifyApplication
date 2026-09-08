from sqlalchemy import BigInteger, Date, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StudentInfo(Base):
    __tablename__ = "student_info"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger)
    student_no: Mapped[str | None] = mapped_column(String(32))
    school: Mapped[str | None] = mapped_column(String(128))
    major: Mapped[str | None] = mapped_column(String(128))
    grade: Mapped[str | None] = mapped_column(String(32))
    abroad_country: Mapped[str | None] = mapped_column(String(64))
    class_teacher_id: Mapped[int | None] = mapped_column(BigInteger)
    enroll_date: Mapped[object | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="active")
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
    update_time: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
