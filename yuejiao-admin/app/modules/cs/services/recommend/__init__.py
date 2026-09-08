"""Export course recommendation service."""

from app.modules.cs.services.recommend.course_matcher import (
    CourseRecommendationService,
    course_matcher,
)

__all__ = [
    "CourseRecommendationService",
    "course_matcher",
]
