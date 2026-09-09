import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.response import ok
from app.db.session import get_sync_db
from app.integrations.dify.student_client import StudentDifyClient
from app.modules.student.crud import assistant as crud
from app.modules.student.schemas.assistant import ChatRequest, LeaveCreate, ProgressCreate, TicketCreate
from app.modules.student.models.assistant import ApplicationProgress
from app.modules.student.services import assistant as student_service

router = APIRouter(prefix="/student", tags=["student"])


def get_student_id(x_user_id: int | None = Header(default=None)) -> int:
    if x_user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-Id header")
    return x_user_id


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
def get_overview(db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    return ok(student_service.overview(db, student_id))


@router.get("/leaves")
def get_leaves(db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    return ok(crud.list_leaves(db, student_id))


@router.post("/leaves", status_code=status.HTTP_201_CREATED)
def create_leave(payload: LeaveCreate, db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    try:
        return ok(student_service.submit_leave(db, student_id, payload), "Leave request submitted")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/tickets")
def get_tickets(db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    return ok(crud.list_tickets(db, student_id))


@router.post("/tickets", status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    return ok(student_service.submit_ticket(db, student_id, payload), "Feedback ticket submitted")


@router.get("/academic/deadlines")
def get_deadlines(db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    return ok(crud.list_deadlines(db, student_id))


@router.get("/academic/scores")
def get_scores(
    all_students: bool = Query(default=False),
    db: Session = Depends(get_sync_db),
    student_id: int = Depends(get_student_id),
):
    return ok(crud.list_scores(db, None if all_students else student_id))


@router.get("/application-progress")
def get_progress(db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    return ok(crud.list_progress(db, student_id))


@router.post("/application-progress", status_code=status.HTTP_201_CREATED)
def create_progress(payload: ProgressCreate, db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    item = ApplicationProgress(student_id=student_id, target_school=payload.target_school, target_major=payload.target_major,
                               stage="submitted", progress_detail=payload.progress_detail or "学生已提交申请，等待顾问受理。",
                               deadline=payload.deadline.date() if payload.deadline else None, next_action=payload.next_action or "等待顾问反馈。", handler_id=7)
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(item, "申请进度已提交")


@router.get("/psych/profile")
def get_psych_profile(db: Session = Depends(get_sync_db), student_id: int = Depends(get_student_id)):
    return ok(crud.get_psych_profile(db, student_id))


@router.get("/overseas/knowledge")
def get_overseas_knowledge(
    category: str | None = None,
    keyword: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_sync_db),
    student_id: int = Depends(get_student_id),
):
    info = crud.get_student_info(db, student_id)
    return ok(crud.list_overseas_knowledge(db, info.abroad_country if info else None, category, keyword))
