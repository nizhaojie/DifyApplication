"""Tests for Dify platform integration, OpenAPI tool schemas, and DSL workflow configs."""

import json
from pathlib import Path
import pytest
import yaml
from fastapi.testclient import TestClient
from app.db.session import SessionLocal
from app.main import app
from app.modules.cs.schemas.schemas import ChatRequest
from app.modules.cs.services.dify.dify_service import dify_service


@pytest.fixture
def db_session():
    """Yield database session and cleanup."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


def test_dify_openapi_tool_validity():
    """Validate that OpenAPI 3.0 tool schema conforms to specifications and includes all tools."""
    tool_schema = dify_service.get_openapi_tool_dict()
    assert tool_schema["openapi"].startswith("3.0.")
    assert "info" in tool_schema
    assert "paths" in tool_schema

    paths = tool_schema["paths"]
    expected_endpoints = [
        "/courses/recommend",
        "/events",
        "/events/register",
        "/faq/match",
        "/kb/search",
    ]
    for endpoint in expected_endpoints:
        assert endpoint in paths, f"Missing required Dify tool endpoint: {endpoint}"

    # Verify operation IDs
    assert paths["/courses/recommend"]["post"]["operationId"] == "recommendCourses"
    assert paths["/events"]["get"]["operationId"] == "listEvents"
    assert paths["/events/register"]["post"]["operationId"] == "registerEvent"
    assert paths["/faq/match"]["post"]["operationId"] == "matchFaq"
    assert paths["/kb/search"]["post"]["operationId"] == "searchKnowledgeBase"


def test_dify_dsl_structure_validity():
    """Verify Dify Chatflow DSL contains the 7-class classifier, RAG, and anti-hallucination rules."""
    dsl_text = dify_service.get_workflow_dsl_content()
    assert dsl_text, "Dify DSL workflow content must not be empty"

    parsed_dsl = yaml.safe_load(dsl_text)
    assert parsed_dsl["app"]["name"] == "cs-agent-main"
    assert parsed_dsl["app"]["mode"] == "advanced-chat"

    nodes = parsed_dsl["workflow"]["nodes"]
    node_ids = {n["id"]: n for n in nodes}

    assert "node_start" in node_ids
    assert "node_classifier" in node_ids
    assert "node_llm_reasoning" in node_ids
    assert "node_answer" in node_ids

    # Verify 7 intent classes in question classifier
    classifier_node = node_ids["node_classifier"]
    class_names = [c["name"] for c in classifier_node["data"]["classes"]]
    expected_classes = [
        "company_inquiry",
        "business_query",
        "policy_query",
        "faq",
        "course_recommend",
        "event_register",
        "casual_chat",
    ]
    for exp_cls in expected_classes:
        assert exp_cls in class_names, f"Classifier missing class: {exp_cls}"

    # Verify anti-hallucination and official account safeguards in prompt
    llm_node = node_ids["node_llm_reasoning"]
    system_prompt = llm_node["data"]["prompt_template"][0]["text"]
    assert "9550889900011455492" in system_prompt  # Official bank account
    assert "广发银行广州华夏路支行" in system_prompt
    assert "时效性" in system_prompt  # Visa policy disclaimer
    assert "防幻觉" in system_prompt or "虚假" in system_prompt


def test_dify_service_execution_and_local_fallback(db_session):
    """Test dify_service dual-engine routing and graceful fallback to local engine."""
    chat_request = ChatRequest(
        message="请问德国双元制职业教育带薪实训每月津贴是多少？",
        visitor_name="测试学员",
        visitor_contact="13800000000",
    )

    # When unconfigured or remote unreachable, should seamlessly process through local engine
    outcome = dify_service.execute_chat_flow(chat_request, db_session)
    assert outcome.session_id is not None
    assert len(outcome.reply) > 10
    assert outcome.intent_code in ["faq", "business_query", "dify_workflow", "company_inquiry"]
    assert outcome.response_time_ms >= 0


def test_dify_api_endpoints_via_client(test_client):
    """Test HTTP endpoints for downloading Dify OpenAPI schema, DSL, and status."""
    # 1. OpenAPI schema
    res_schema = test_client.get("/api/v1/cs/dify/tools/openapi.json")
    assert res_schema.status_code == 200
    schema_data = res_schema.json()
    assert schema_data["openapi"].startswith("3.0.")
    assert "/courses/recommend" in schema_data["paths"]

    # 2. Workflow DSL
    res_dsl = test_client.get("/api/v1/cs/dify/dsl")
    assert res_dsl.status_code == 200
    dsl_json = res_dsl.json()
    assert dsl_json["code"] == 200
    assert "cs-agent-main" in dsl_json["data"]["dsl"]

    # 3. Dify Status
    res_status = test_client.get("/api/v1/cs/dify/status")
    assert res_status.status_code == 200
    status_json = res_status.json()
    assert "is_configured" in status_json["data"]
    assert "engine_mode" in status_json["data"]
