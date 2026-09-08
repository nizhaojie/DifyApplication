from sqlalchemy import BigInteger, DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StudentScore(Base):
    __tablename__ = "student_score"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(BigInteger)
    course_name: Mapped[str] = mapped_column(String(128))
    score: Mapped[object] = mapped_column(Numeric(5, 2))
    semester: Mapped[str | None] = mapped_column(String(32))
    credit: Mapped[object | None] = mapped_column(Numeric(3, 1))
    recorded_by: Mapped[int | None] = mapped_column(BigInteger)
    create_time: Mapped[object] = mapped_column(DateTime, server_default=func.now())
