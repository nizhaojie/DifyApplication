from datetime import date

from pydantic import BaseModel


class LeadIn(BaseModel):
    customer_name: str | None = None
    contact_info: str | None = None
    gender: str | None = "U"
    age: int | None = None
    education_level: str | None = None
    intended_country: str | None = None
    intended_major: str | None = None
    background_info: str | None = None
    source_channel: str | None = None
    status: str | None = "new"
    owner_employee_id: int | None = None
    remark: str | None = None
    lost_reason: str | None = None
    follow_type: str | None = None
    content: str | None = None
    next_plan: str | None = None
    text: str | None = None
    query: str | None = None
    employee_id: int | None = None
    action: str | None = None
    approval_comment: str | None = None
    report_date: date | None = None
    student_id: int | None = None
    course_name: str | None = None
    score: float | None = None
    semester: str | None = None
    credit: float | None = None
    conversation_id: str | None = None
    student_name: str | None = None
    leave_type: str | None = None
    category: str | None = None
    title: str | None = None
    solution: str | None = None
    priority: str | None = None
    ticket_type: str | None = None
