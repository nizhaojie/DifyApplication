"""Export cs module Pydantic schemas."""

from app.modules.cs.schemas.schemas import (
    ChatMessageItem,
    ChatRequest,
    ChatResponse,
    ChatSessionCreate,
    ChatSessionResponse,
    CourseProjectItem,
    CourseRecommendRequest,
    CourseRecommendResponse,
    EventLectureItem,
    EventRegisterRequest,
    EventRegisterResponse,
    FaqMatchRequest,
    FaqMatchResult,
    KnowledgeChunkResult,
    KnowledgeSearchRequest,
)

__all__ = [
    "ChatSessionCreate",
    "ChatSessionResponse",
    "ChatMessageItem",
    "ChatRequest",
    "ChatResponse",
    "CourseProjectItem",
    "CourseRecommendRequest",
    "CourseRecommendResponse",
    "EventLectureItem",
    "EventRegisterRequest",
    "EventRegisterResponse",
    "KnowledgeSearchRequest",
    "KnowledgeChunkResult",
    "FaqMatchRequest",
    "FaqMatchResult",
]
