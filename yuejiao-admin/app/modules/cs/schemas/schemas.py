"""Pydantic data schemas for Customer Service (cs) module."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Session & Chat Schemas
# ---------------------------------------------------------------------------

class ChatSessionCreate(BaseModel):
    """Payload for initializing a conversation session."""

    visitor_name: Optional[str] = Field(default=None, max_length=64, description="Visitor nickname")
    visitor_contact: Optional[str] = Field(default=None, max_length=128, description="Visitor phone/wechat")


class ChatSessionResponse(BaseModel):
    """Conversation session detail response."""

    id: int
    session_id: str
    visitor_name: Optional[str] = None
    visitor_contact: Optional[str] = None
    status: str
    last_message_time: Optional[datetime] = None
    create_time: datetime

    model_config = {"from_attributes": True}


class ChatMessageItem(BaseModel):
    """Single message entry in conversation history."""

    id: int
    session_id: str
    role: str
    content: str
    intent: Optional[str] = None
    tokens_used: Optional[int] = None
    response_time_ms: Optional[int] = None
    create_time: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    """User incoming message to the customer service agent."""

    session_id: Optional[str] = Field(default=None, description="Existing session identifier")
    message: str = Field(..., min_length=1, max_length=2000, description="User question or dialogue")
    visitor_name: Optional[str] = Field(default=None, description="Visitor name if provided")
    visitor_contact: Optional[str] = Field(default=None, description="Visitor contact for lead capture")


class ChatResponse(BaseModel):
    """Complete assistant response for a conversation turn."""

    session_id: str
    reply: str
    intent_code: str
    intent_name: str
    source_references: List[str] = Field(default_factory=list, description="Knowledge source file references")
    card_type: Optional[str] = Field(default=None, description="Structured UI card type (e.g. course_list, event_list, register_success)")
    card_content: Optional[Any] = Field(default=None, description="Card payload dictionary or list")
    tokens_used: int = Field(default=0)
    response_time_ms: int = Field(default=0)


# ---------------------------------------------------------------------------
# Course Recommendation Schemas
# ---------------------------------------------------------------------------

class CourseProjectItem(BaseModel):
    """Course project representation schema."""

    id: int
    project_name: str
    category: Optional[str] = None
    description: Optional[str] = None
    target_audience: Optional[str] = None
    price: Optional[float] = None
    duration: Optional[str] = None
    tags: Optional[List[str]] = None
    status: int

    model_config = {"from_attributes": True}


class CourseRecommendRequest(BaseModel):
    """Filter criteria for matching study programs and courses."""

    education_level: Optional[str] = Field(
        default=None,
        description="Current education level: 初中/中专/职高/高中/大专/本科",
    )
    target_country: Optional[str] = Field(
        default=None,
        description="Target study country: 德国/新加坡/其他",
    )
    budget_max: Optional[float] = Field(
        default=None,
        description="Maximum budget in RMB (e.g. 300000)",
    )
    interest_keyword: Optional[str] = Field(
        default=None,
        description="Major or keyword interest (e.g. 计算机, 机械, 医疗, 航空, 酒店)",
    )
    recommend_limit: int = Field(default=3, ge=1, le=10, description="Max returned programs")


class CourseRecommendResponse(BaseModel):
    """Structured response for course recommendations."""

    is_matched: bool = Field(description="Whether matching courses were found")
    match_count: int
    recommended_courses: List[CourseProjectItem]
    recommendation_rationale: str
    follow_up_suggestion: Optional[str] = None


# ---------------------------------------------------------------------------
# Event & Registration Schemas
# ---------------------------------------------------------------------------

class EventLectureItem(BaseModel):
    """Event / lecture information item."""

    id: int
    event_name: str
    event_type: str
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    max_participants: Optional[int] = None
    current_participants: int
    has_available_seats: bool
    status: str

    model_config = {"from_attributes": True}


class EventRegisterRequest(BaseModel):
    """Registration request payload."""

    event_id: int = Field(..., description="Target event ID")
    customer_name: str = Field(..., min_length=2, max_length=64, description="Registrant full name")
    contact_info: str = Field(..., min_length=6, max_length=128, description="Registrant phone or email")
    remark: Optional[str] = Field(default=None, max_length=255, description="Additional notes")


class EventRegisterResponse(BaseModel):
    """Registration outcome response."""

    is_success: bool
    registration_id: Optional[int] = None
    event_name: str
    message: str


# ---------------------------------------------------------------------------
# Knowledge Base & FAQ Schemas
# ---------------------------------------------------------------------------

class KnowledgeSearchRequest(BaseModel):
    """Query payload for knowledge base hybrid search."""

    query: str = Field(..., min_length=1, description="Question or keyword")
    category: Optional[str] = Field(default=None, description="Category filter (company_info/business/policy/faq)")
    top_k: int = Field(default=3, ge=1, le=10)


class KnowledgeChunkResult(BaseModel):
    """Matched knowledge base chunk."""

    chunk_id: int
    category: str
    title: str
    content: str
    source_file: Optional[str] = None
    relevance_score: float


class FaqMatchRequest(BaseModel):
    """Query payload for direct FAQ matching."""

    question: str = Field(..., min_length=1, description="User question")
    confidence_threshold: float = Field(default=0.6, ge=0.0, le=1.0)


class FaqMatchResult(BaseModel):
    """Direct FAQ answer match."""

    is_matched: bool
    standard_question: Optional[str] = None
    answer: Optional[str] = None
    confidence_score: float
