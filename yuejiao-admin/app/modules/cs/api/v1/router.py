"""FastAPI endpoints for Customer Service (cs) module."""

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.response import fail, ok
from app.modules.cs.crud.crud import list_messages_by_session_id
from app.modules.cs.schemas.schemas import (
    ChatMessageItem,
    ChatRequest,
    ChatResponse,
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
from app.modules.cs.services.chat.dialog_engine import dialog_manager
from app.modules.cs.services.dify.dify_service import dify_service
from app.modules.cs.services.event.event_service import event_service
from app.modules.cs.services.rag.faq_engine import faq_engine
from app.modules.cs.services.rag.kb_engine import kb_engine
from app.modules.cs.services.recommend.course_matcher import course_matcher

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cs", tags=["Customer Service Agent"])


@router.post(
    "/chat",
    summary="7-Scenario Customer Service Chat",
)
async def chat_endpoint(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Main conversational endpoint coordinating 7 customer service scenarios."""
    try:
        response_payload = await dify_service.execute_chat_flow(chat_request=request, db_session=db)
        return ok(response_payload.model_dump(mode="json"))
    except Exception as exc:
        logger.exception("Chat processing failed: %s", exc)
        return fail(f"Chat processing failed: {exc}")


@router.get(
    "/sessions/{session_id}/messages",
    summary="Get Session Message History",
)
async def get_session_history(
    session_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve chronologically ordered message history for a conversation session."""
    messages = await list_messages_by_session_id(db=db, session_id=session_id, limit=limit)
    item_list = [ChatMessageItem.model_validate(msg).model_dump(mode="json") for msg in messages]
    return ok(item_list)


@router.post(
    "/courses/recommend",
    summary="Intelligent Course & Program Recommendation",
)
async def recommend_courses_endpoint(
    request: CourseRecommendRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Recommend best-fit educational programs based on education, country, and budget."""
    recommendation = await course_matcher.recommend(db=db, criteria=request)
    return ok(recommendation.model_dump(mode="json"))


@router.get(
    "/events",
    summary="List Upcoming Seminar Events",
)
async def list_events_endpoint(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Fetch active and upcoming seminar lecture events."""
    events = await event_service.list_active_events(db=db)
    return ok([event.model_dump(mode="json") for event in events])


@router.post(
    "/events/register",
    summary="Register for a Seminar Event",
)
async def register_event_endpoint(
    request: EventRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Sign up for an event lecture with seat check and anti-duplication."""
    registration_outcome = await event_service.register(db=db, payload=request)
    if registration_outcome.is_success:
        return ok(registration_outcome.model_dump(mode="json"))
    return fail(registration_outcome.message, data=registration_outcome.model_dump(mode="json"))


@router.get(
    "/events/registrations",
    summary="Query User Event Registrations",
)
async def query_user_registrations_endpoint(
    contact_info: str = Query(..., description="Phone number or contact info"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve all active seminar registrations for a given contact."""
    records = await event_service.query_user_registrations(db=db, contact_info=contact_info)
    return ok(records)


@router.post(
    "/kb/search",
    summary="Knowledge Base Hybrid Search",
)
async def search_knowledge_base_endpoint(
    request: KnowledgeSearchRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Perform hybrid keyword retrieval over segmented knowledge documents."""
    results = await kb_engine.search(
        db=db,
        query=request.query,
        category_filter=request.category,
        top_k=request.top_k,
    )
    return ok([result.model_dump(mode="json") for result in results])


@router.post(
    "/faq/match",
    summary="Direct FAQ Precision Match",
)
async def match_faq_endpoint(
    request: FaqMatchRequest,
) -> Dict[str, Any]:
    """Sub-millisecond direct match against standard 36 FAQ questions."""
    match_outcome = faq_engine.match(
        user_question=request.question,
        confidence_threshold=request.confidence_threshold,
    )
    return ok(match_outcome.model_dump(mode="json"))


@router.get(
    "/faqs",
    summary="List All Standard FAQs for Quick Drawer",
)
async def list_faqs_endpoint() -> Dict[str, Any]:
    """Retrieve full catalogue of 36 FAQ question-answer pairs for frontend shortcuts."""
    faq_catalog = [item.model_dump() for item in faq_engine.list_all_faqs()]
    return ok(faq_catalog)


@router.get(
    "/dify/status",
    summary="Check Dify Integration Status",
)
async def get_dify_status_endpoint() -> Dict[str, Any]:
    """Check Dify connection and configuration parameters."""
    return ok(
        {
            "is_configured": dify_service.is_configured,
            "engine_mode": "dify" if dify_service.is_configured else "local_fallback",
        }
    )
