from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = Field(default=None, max_length=128)


class LeaveCreate(BaseModel):
    leave_type: str = Field(pattern="^(sick|personal|emergency)$")
    start_time: datetime
    end_time: datetime
    reason: str = Field(min_length=1, max_length=2000)
    attachment_url: str | None = Field(default=None, max_length=512)


class TicketCreate(BaseModel):
    ticket_type: str = Field(default="complaint", pattern="^(complaint|suggestion|consult)$")
    category: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=255)
    content: str = Field(min_length=1, max_length=4000)
    detail: str | None = Field(default=None, max_length=10000)
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")


class ProgressCreate(BaseModel):
    target_school: str = Field(min_length=1, max_length=128)
    target_major: str | None = Field(default=None, max_length=128)
    progress_detail: str | None = Field(default=None, max_length=4000)
    deadline: datetime | None = None
    next_action: str | None = Field(default=None, max_length=255)
