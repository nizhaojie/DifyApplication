from sqlalchemy.orm import Session

from app.modules.student.crud import assistant as crud
from app.modules.student.schemas.assistant import LeaveCreate, TicketCreate


def overview(db: Session, student_id: int) -> dict[str, int]:
    leaves = crud.list_leaves(db, student_id)
    tickets = crud.list_tickets(db, student_id)
    deadlines = crud.list_deadlines(db, student_id)
    return {
        "pending_leaves": sum(item.status == "pending" for item in leaves),
        "open_tickets": sum(item.status in {"pending", "processing"} for item in tickets),
        "upcoming_deadlines": sum(item.status in {"pending", "reminded"} for item in deadlines),
        "open_psych_alerts": crud.count_open_alerts(db, student_id),
    }


def submit_leave(db: Session, student_id: int, payload: LeaveCreate):
    if payload.end_time <= payload.start_time:
        raise ValueError("end_time must be later than start_time")
    return crud.create_leave(db, student_id, payload)


def submit_ticket(db: Session, student_id: int, payload: TicketCreate):
    return crud.create_ticket(db, student_id, payload)
