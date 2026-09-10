"""Unit tests for Course and Program Intelligent Recommendation Engine."""

import pytest
from app.db.session import AsyncSessionLocal
from app.modules.cs.schemas.schemas import CourseRecommendRequest
from app.modules.cs.services.recommend.course_matcher import course_matcher


@pytest.fixture
async def db_session():
    """Yield database session for testing course matching."""
    session = AsyncSessionLocal()
    yield session
    await session.close()


async def test_junior_high_recommendation(db_session):
    """User with middle school education should match Singapore 2+2 program."""
    request_data = CourseRecommendRequest(
        education_level="初中",
        target_country="新加坡",
        recommend_limit=2,
    )
    response = await course_matcher.recommend(db=db_session, criteria=request_data)
    assert response.is_matched is True
    assert len(response.recommended_courses) > 0
    top_course = response.recommended_courses[0]
    assert "2+2" in top_course.project_name
    assert "初中" in top_course.target_audience


async def test_junior_college_fast_track_recommendation(db_session):
    """User with college degree should match top-up bachelor/master program."""
    request_data = CourseRecommendRequest(
        education_level="大专",
        target_country="新加坡",
        recommend_limit=2,
    )
    response = await course_matcher.recommend(db=db_session, criteria=request_data)
    assert response.is_matched is True
    top_course = response.recommended_courses[0]
    assert "专升本" in top_course.project_name or "本升硕" in top_course.project_name


async def test_german_dual_system_budget_matching(db_session):
    """User asking for Germany with low/zero budget should match Dual System."""
    request_data = CourseRecommendRequest(
        education_level="高中",
        target_country="德国",
        budget_max=10000.0,
        recommend_limit=2,
    )
    response = await course_matcher.recommend(db=db_session, criteria=request_data)
    assert response.is_matched is True
    assert len(response.recommended_courses) > 0
    top_course = response.recommended_courses[0]
    assert "双元制" in top_course.project_name
    assert top_course.price == 0.0


async def test_follow_up_prompt_when_country_missing(db_session):
    """When user omits destination country, agent should provide clarifying follow-up."""
    request_data = CourseRecommendRequest(
        education_level="高中",
        recommend_limit=2,
    )
    response = await course_matcher.recommend(db=db_session, criteria=request_data)
    assert response.is_matched is True
    assert response.follow_up_suggestion is not None
    assert "国家" in response.follow_up_suggestion
