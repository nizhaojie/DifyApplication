from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.student.models.admin import StudentAdminService
from app.modules.student.models.assistant import AcademicDeadline, ApplicationProgress, OverseasLifeKnowledge, StudentPsychAlert, StudentPsychProfile
from app.modules.student.models.info import StudentInfo
from app.modules.student.models.score import StudentScore
from app.modules.student.models.ticket import StudentFeedbackTicket
from app.modules.student.schemas.assistant import LeaveCreate, TicketCreate


async def get_student_info(db: AsyncSession, student_id: int) -> StudentInfo | None:
    return await db.scalar(select(StudentInfo).where(StudentInfo.user_id == student_id))


async def list_leaves(db: AsyncSession, student_id: int) -> list[StudentAdminService]:
    return list(await db.scalars(select(StudentAdminService).where(StudentAdminService.student_id == student_id).order_by(StudentAdminService.create_time.desc())))


async def create_leave(db: AsyncSession, student_id: int, payload: LeaveCreate) -> StudentAdminService:
    item = StudentAdminService(student_id=student_id, service_type="leave", status="pending", **payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def list_tickets(db: AsyncSession, student_id: int) -> list[StudentFeedbackTicket]:
    return list(await db.scalars(select(StudentFeedbackTicket).where(StudentFeedbackTicket.student_id == student_id).order_by(StudentFeedbackTicket.create_time.desc())))


async def create_ticket(db: AsyncSession, student_id: int, payload: TicketCreate) -> StudentFeedbackTicket:
    item = StudentFeedbackTicket(student_id=student_id, status="pending", **payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def list_deadlines(db: AsyncSession, student_id: int) -> list[AcademicDeadline]:
    query = select(AcademicDeadline).where(or_(AcademicDeadline.student_id == student_id, AcademicDeadline.student_id.is_(None)))
    return list(await db.scalars(query.order_by(AcademicDeadline.deadline.asc())))


async def list_scores(db: AsyncSession, student_id: int | None = None) -> list[StudentScore]:
    query = select(StudentScore)
    if student_id is not None:
        query = query.where(StudentScore.student_id == student_id)
    return list(await db.scalars(query.order_by(StudentScore.semester.desc(), StudentScore.student_id.asc(), StudentScore.id.asc())))


async def list_progress(db: AsyncSession, student_id: int) -> list[ApplicationProgress]:
    return list(await db.scalars(select(ApplicationProgress).where(ApplicationProgress.student_id == student_id).order_by(ApplicationProgress.update_time.desc())))


async def get_psych_profile(db: AsyncSession, student_id: int) -> StudentPsychProfile | None:
    return await db.scalar(select(StudentPsychProfile).where(StudentPsychProfile.student_id == student_id))


async def count_open_alerts(db: AsyncSession, student_id: int) -> int:
    query = select(StudentPsychAlert.id).where(StudentPsychAlert.student_id == student_id, StudentPsychAlert.status.in_(["pending", "following"]))
    return len(list(await db.scalars(query)))


async def list_overseas_knowledge(db: AsyncSession, country: str | None, category: str | None, keyword: str | None) -> list[OverseasLifeKnowledge]:
    query = select(OverseasLifeKnowledge).where(OverseasLifeKnowledge.status == 1)
    if country:
        query = query.where(OverseasLifeKnowledge.country == country)
    if category:
        query = query.where(OverseasLifeKnowledge.category == category)
    if keyword:
        query = query.where(or_(OverseasLifeKnowledge.title.contains(keyword), OverseasLifeKnowledge.content.contains(keyword)))
    return list(await db.scalars(query.order_by(OverseasLifeKnowledge.id.desc()).limit(10)))
