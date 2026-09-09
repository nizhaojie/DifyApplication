from app.modules.student.models.admin import StudentAdminService
from app.modules.student.models.info import StudentInfo
from app.modules.student.models.score import StudentScore
from app.modules.student.models.ticket import StudentFeedbackTicket
from app.modules.student.models.assistant import (
    AcademicDeadline,
    ApplicationProgress,
    OverseasLifeKnowledge,
    StudentPsychAlert,
    StudentPsychProfile,
)

__all__ = [
    "AcademicDeadline",
    "ApplicationProgress",
    "OverseasLifeKnowledge",
    "StudentAdminService",
    "StudentFeedbackTicket",
    "StudentInfo",
    "StudentPsychAlert",
    "StudentPsychProfile",
    "StudentScore",
]
