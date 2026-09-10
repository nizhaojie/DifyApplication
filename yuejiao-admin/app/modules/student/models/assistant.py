from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Integer, String, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StudentPsychProfile(Base):
    __tablename__ = "student_psych_profile"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    latest_emotion_tag: Mapped[str | None] = mapped_column(String(64))
    emotion_score: Mapped[int | None] = mapped_column(Integer)
    last_interaction_time: Mapped[datetime | None] = mapped_column(DateTime)
    risk_level: Mapped[str] = mapped_column(String(20), default="low")
    weekly_summary: Mapped[dict | None] = mapped_column(JSON)


class StudentPsychRecord(Base):
    __tablename__ = "student_psych_record"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(BigInteger, index=True)
    emotion_tag: Mapped[str | None] = mapped_column(String(64))
    emotion_score: Mapped[int | None] = mapped_column(Integer)
    interaction_content: Mapped[str | None] = mapped_column(Text)
    trigger_keywords: Mapped[list | None] = mapped_column(JSON)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StudentPsychAlert(Base):
    __tablename__ = "student_psych_alert"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(BigInteger, index=True)
    trigger_reason: Mapped[str] = mapped_column(Text)
    risk_level: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    teacher_id: Mapped[int | None] = mapped_column(BigInteger)
    follow_record: Mapped[str | None] = mapped_column(Text)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AcademicDeadline(Base):
    __tablename__ = "academic_deadline"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int | None] = mapped_column(BigInteger, index=True)
    deadline_type: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[datetime] = mapped_column(DateTime, index=True)
    reminder_enabled: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="pending")


class ApplicationProgress(Base):
    __tablename__ = "application_progress"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(BigInteger, index=True)
    target_school: Mapped[str] = mapped_column(String(128))
    target_major: Mapped[str | None] = mapped_column(String(128))
    stage: Mapped[str] = mapped_column(String(32))
    progress_detail: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[date | None] = mapped_column(Date)
    next_action: Mapped[str | None] = mapped_column(String(255))
    handler_id: Mapped[int | None] = mapped_column(BigInteger)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OverseasLifeKnowledge(Base):
    __tablename__ = "overseas_life_knowledge"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    country: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[int] = mapped_column(Integer, default=1)
