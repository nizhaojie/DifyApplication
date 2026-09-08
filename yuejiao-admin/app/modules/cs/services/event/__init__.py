"""Export event service."""

from app.modules.cs.services.event.event_service import (
    EventLectureService,
    event_service,
)

__all__ = [
    "EventLectureService",
    "event_service",
]
