"""Export cs module ORM models."""

from app.modules.cs.models.models import (
    ChatMessage,
    ChatSession,
    CourseProject,
    EventLecture,
    EventRegistration,
    IntentConfig,
    KnowledgeBase,
)

__all__ = [
    "ChatSession",
    "ChatMessage",
    "CourseProject",
    "EventLecture",
    "EventRegistration",
    "KnowledgeBase",
    "IntentConfig",
]
