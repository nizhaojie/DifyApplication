import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.exceptions import BizError
from app.core.response import ok
from app.integrations.dify.student_client import StudentDifyClient
from app.modules.student.crud import assistant as crud
from app.modules.student.models.assistant import ApplicationProgress
from app.modules.student.models.info import StudentInfo
from app.modules.student.services import assistant as student_service
from app.modules.student.schemas.assistant import ChatRequest, LeaveCreate, ProgressCreate, TicketCreate
from app.modules.system.models.user import SysUser

router = APIRouter(prefix="/student", tags=["student"])


async def get_student_id(
    db: AsyncSession = Depends(get_db),
    current_user: SysUser = Depends(get_current_user),
) -> int:
    """学生身份只从登录态推导；客户端传入的学生标识一律不采信。"""
    result = await db.execute(select(StudentInfo.id).where(StudentInfo.user_id == current_user.id))
    student_id = result.scalar_one_or_none()
    if student_id is None:
        raise BizError("当前用户未绑定学生档案", code=403)
    return student_id


@router.post("/chat/{scene}")
async def chat(scene: str, payload: ChatRequest, student_id: int = Depends(get_student_id)):
    if scene not in {"psych", "life", "program"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown assistant scene")
    client = StudentDifyClient(scene)
    if not client.configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Dify {scene} application is not configured")
    try:
        result = await client.chat(payload.query, user=f"student-{student_id}", conversation_id=payload.conversation_id)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Dify request failed") from exc
    answer = result.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Dify returned no answer")
    return ok({"answer": answer, "conversation_id": result.get("conversation_id"), "message_id": result.get("message_id")})


@router.get("/overview")
async def get_overview(db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    return ok(await student_service.overview(db, student_id))


@router.get("/leaves")
async def get_leaves(db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    return ok(await crud.list_leaves(db, student_id))


@router.post("/leaves", status_code=status.HTTP_201_CREATED)
async def create_leave(payload: LeaveCreate, db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    try:
        return ok(await student_service.submit_leave(db, student_id, payload), "Leave request submitted")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/tickets")
async def get_tickets(db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    return ok(await crud.list_tickets(db, student_id))


@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def create_ticket(payload: TicketCreate, db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    return ok(await student_service.submit_ticket(db, student_id, payload), "Feedback ticket submitted")


@router.get("/academic/deadlines")
async def get_deadlines(db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    return ok(await crud.list_deadlines(db, student_id))


@router.get("/academic/scores")
async def get_scores(
    all_students: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    student_id: int = Depends(get_student_id),
):
    return ok(await crud.list_scores(db, None if all_students else student_id))


@router.get("/application-progress")
async def get_progress(db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    return ok(await crud.list_progress(db, student_id))


@router.post("/application-progress", status_code=status.HTTP_201_CREATED)
async def create_progress(payload: ProgressCreate, db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    item = ApplicationProgress(student_id=student_id, target_school=payload.target_school, target_major=payload.target_major,
                               stage="submitted", progress_detail=payload.progress_detail or "学生已提交申请，等待顾问受理。",
                               deadline=payload.deadline.date() if payload.deadline else None, next_action=payload.next_action or "等待顾问反馈。", handler_id=7)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ok(item, "申请进度已提交")


@router.get("/psych/profile")
async def get_psych_profile(db: AsyncSession = Depends(get_db), student_id: int = Depends(get_student_id)):
    return ok(await crud.get_psych_profile(db, student_id))


@router.get("/overseas/knowledge")
async def get_overseas_knowledge(
    category: str | None = None,
    keyword: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    student_id: int = Depends(get_student_id),
):
    info = await crud.get_student_info(db, student_id)
    return ok(await crud.list_overseas_knowledge(db, info.abroad_country if info else None, category, keyword))
