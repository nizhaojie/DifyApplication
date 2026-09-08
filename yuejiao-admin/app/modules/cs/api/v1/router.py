"""FastAPI endpoints for Customer Service (cs) module."""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.deps import get_db
from app.core.response import UnifiedResponse, make_error_response, make_success_response
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
from app.modules.cs.services.event.event_service import event_service
from app.modules.cs.services.rag.faq_engine import faq_engine
from app.modules.cs.services.rag.kb_engine import kb_engine
from app.modules.cs.services.recommend.course_matcher import course_matcher

router = APIRouter(prefix="/cs", tags=["Customer Service Agent"])


@router.post(
    "/chat",
    response_model=UnifiedResponse[ChatResponse],
    summary="7-Scenario Customer Service Chat",
)
def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
) -> UnifiedResponse[ChatResponse]:
    """Main conversational endpoint coordinating 7 customer service scenarios."""
    try:
        from app.modules.cs.services.dify.dify_service import dify_service
        response_payload = dify_service.execute_chat_flow(chat_request=request, db_session=db)
        return make_success_response(payload=response_payload)
    except Exception as exc:
        return make_error_response(message=f"Chat processing failed: {str(exc)}")


@router.get(
    "/sessions/{session_id}/messages",
    response_model=UnifiedResponse[List[ChatMessageItem]],
    summary="Get Session Message History",
)
def get_session_history(
    session_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> UnifiedResponse[List[ChatMessageItem]]:
    """Retrieve chronologically ordered message history for a conversation session."""
    messages = list_messages_by_session_id(db=db, session_id=session_id, limit=limit)
    item_list = [ChatMessageItem.model_validate(msg) for msg in messages]
    return make_success_response(payload=item_list)


@router.post(
    "/courses/recommend",
    response_model=UnifiedResponse[CourseRecommendResponse],
    summary="Intelligent Course & Program Recommendation",
)
def recommend_courses_endpoint(
    request: CourseRecommendRequest,
    db: Session = Depends(get_db),
) -> UnifiedResponse[CourseRecommendResponse]:
    """Recommend best-fit educational programs based on education, country, and budget."""
    recommendation = course_matcher.recommend(db=db, criteria=request)
    return make_success_response(payload=recommendation)


@router.get(
    "/events",
    response_model=UnifiedResponse[List[EventLectureItem]],
    summary="List Upcoming Seminar Events",
)
def list_events_endpoint(
    db: Session = Depends(get_db),
) -> UnifiedResponse[List[EventLectureItem]]:
    """Fetch active and upcoming seminar lecture events."""
    events = event_service.list_active_events(db=db)
    return make_success_response(payload=events)


@router.post(
    "/events/register",
    response_model=UnifiedResponse[EventRegisterResponse],
    summary="Register for a Seminar Event",
)
def register_event_endpoint(
    request: EventRegisterRequest,
    db: Session = Depends(get_db),
) -> UnifiedResponse[EventRegisterResponse]:
    """Sign up for an event lecture with seat check and anti-duplication."""
    registration_outcome = event_service.register(db=db, payload=request)
    if registration_outcome.is_success:
        return make_success_response(payload=registration_outcome)
    return make_error_response(
        message=registration_outcome.message, payload=registration_outcome
    )


@router.get(
    "/events/registrations",
    response_model=UnifiedResponse[List[Dict[str, Any]]],
    summary="Query User Event Registrations",
)
def query_user_registrations_endpoint(
    contact_info: str = Query(..., description="Phone number or contact info"),
    db: Session = Depends(get_db),
) -> UnifiedResponse[List[Dict[str, Any]]]:
    """Retrieve all active seminar registrations for a given contact."""
    records = event_service.query_user_registrations(db=db, contact_info=contact_info)
    return make_success_response(payload=records)


@router.post(
    "/kb/search",
    response_model=UnifiedResponse[List[KnowledgeChunkResult]],
    summary="Knowledge Base Hybrid Search",
)
def search_knowledge_base_endpoint(
    request: KnowledgeSearchRequest,
    db: Session = Depends(get_db),
) -> UnifiedResponse[List[KnowledgeChunkResult]]:
    """Perform hybrid keyword retrieval over segmented knowledge documents."""
    results = kb_engine.search(
        db=db,
        query=request.query,
        category_filter=request.category,
        top_k=request.top_k,
    )
    return make_success_response(payload=results)


@router.post(
    "/faq/match",
    response_model=UnifiedResponse[FaqMatchResult],
    summary="Direct FAQ Precision Match",
)
def match_faq_endpoint(
    request: FaqMatchRequest,
) -> UnifiedResponse[FaqMatchResult]:
    """Sub-millisecond direct match against standard 36 FAQ questions."""
    match_outcome = faq_engine.match(
        user_question=request.question,
        confidence_threshold=request.confidence_threshold,
    )
    return make_success_response(payload=match_outcome)


@router.get(
    "/faqs",
    response_model=UnifiedResponse[List[Dict[str, Any]]],
    summary="List All Standard FAQs for Quick Drawer",
)
def list_faqs_endpoint() -> UnifiedResponse[List[Dict[str, Any]]]:
    """Retrieve full catalogue of 36 FAQ question-answer pairs for frontend shortcuts."""
    faq_catalog = [item.model_dump() for item in faq_engine.list_all_faqs()]
    return make_success_response(payload=faq_catalog)


@router.get(
    "/dify/tools/openapi.json",
    summary="Download Dify OpenAPI 3.0 Custom Tool Schema",
)
def get_dify_tool_schema_endpoint() -> Dict[str, Any]:
    """Provide OpenAPI 3.0 tool schema for direct import into Dify Custom Tools."""
    from app.modules.cs.services.dify.dify_service import dify_service
    return dify_service.get_openapi_tool_dict()


@router.get(
    "/dify/dsl",
    summary="Download Dify Chatflow DSL Configuration",
)
def get_dify_workflow_dsl_endpoint() -> UnifiedResponse[Dict[str, Any]]:
    """Retrieve Dify DSL configuration YAML string for workflow import."""
    from app.modules.cs.services.dify.dify_service import dify_service
    dsl_text = dify_service.get_workflow_dsl_content()
    return make_success_response(payload={"dsl": dsl_text, "app_name": "cs-agent-main"})


@router.get(
    "/dify/status",
    summary="Check Dify Integration Status",
)
def get_dify_status_endpoint() -> UnifiedResponse[Dict[str, Any]]:
    """Check Dify connection and configuration parameters."""
    from app.modules.cs.services.dify.dify_service import dify_service
    return make_success_response(
        payload={
            "is_configured": dify_service.is_configured,
            "engine_mode": "dify" if dify_service.is_configured else "local_fallback",
        }
    )

