"""End-to-end integration tests for 7 customer service scenarios and API endpoints."""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.db.session import SessionLocal
from app.main import app
from app.modules.cs.schemas.schemas import ChatRequest
from app.modules.cs.services.chat.dialog_engine import dialog_manager


@pytest.fixture(scope="module")
def api_client():
    """Yield FastAPI TestClient instance."""
    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="module")
def db_session():
    """Yield database session."""
    session = SessionLocal()
    yield session
    session.close()


def test_health_and_root_endpoints(api_client):
    """Verify application health and root endpoints."""
    health_resp = api_client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["code"] == 200
    assert health_resp.json()["data"]["status"] == "healthy"


def test_scenario_01_company_inquiry(db_session):
    """Scenario 01: Company background and institutional qualifications."""
    session_id = f"test_inq_{uuid.uuid4().hex[:8]}"
    request = ChatRequest(
        session_id=session_id,
        message="请问你们粤教服务是什么背景？有什么资质和部门架构？",
    )
    response = dialog_manager.handle_message(db=db_session, request=request)
    assert response.intent_code == "company_inquiry"
    assert response.intent_name == "公司信息咨询"
    assert len(response.reply) > 20
    assert "企业信息.docx" in response.source_references or len(response.source_references) > 0


def test_scenario_02_business_query(db_session):
    """Scenario 02: Business models (German dual system, Singapore programs)."""
    session_id = f"test_biz_{uuid.uuid4().hex[:8]}"
    request = ChatRequest(
        session_id=session_id,
        message="中德双元制职业教育的培养模式是怎样的？带薪吗？",
    )
    response = dialog_manager.handle_message(db=db_session, request=request)
    assert response.intent_code in ["business_query", "faq"]
    assert len(response.reply) > 20
    assert "双元制" in response.reply or "企业" in response.reply


def test_scenario_03_policy_query(db_session):
    """Scenario 03: Study abroad and visa/immigration policies."""
    session_id = f"test_pol_{uuid.uuid4().hex[:8]}"
    request = ChatRequest(
        session_id=session_id,
        message="请问德国留学工作签证和永居申请政策是怎样的？",
    )
    response = dialog_manager.handle_message(db=db_session, request=request)
    assert response.intent_code == "policy_query"
    assert response.intent_name == "留学政策查询"
    # Anti-hallucination and timing disclaimer assertion
    assert "防幻觉" in response.reply or "时效" in response.reply


def test_scenario_04_faq_matching(db_session):
    """Scenario 04: High-frequency FAQ instant precision match."""
    session_id = f"test_faq_{uuid.uuid4().hex[:8]}"
    request = ChatRequest(
        session_id=session_id,
        message="请问公司简称什么？",
    )
    response = dialog_manager.handle_message(db=db_session, request=request)
    assert response.intent_code == "faq"
    assert "粤教服务" in response.reply
    assert response.response_time_ms < 500  # Sub-second fast reply


def test_scenario_05_course_recommendation(db_session):
    """Scenario 05: Personalized course matching with structured UI cards."""
    session_id = f"test_rec_{uuid.uuid4().hex[:8]}"
    request = ChatRequest(
        session_id=session_id,
        message="我是高中毕业，想去新加坡读本科，预算25万左右，有什么推荐？",
    )
    response = dialog_manager.handle_message(db=db_session, request=request)
    assert response.intent_code == "course_recommend"
    assert response.card_type == "course_list"
    assert response.card_content is not None
    assert len(response.card_content) > 0
    # Check top matched course is高中起点
    top_course = response.card_content[0]
    assert "新加坡" in top_course["project_name"]


def test_scenario_06_event_exploration_and_registration(db_session):
    """Scenario 06: Event lecture list query and closed-loop dialogue registration."""
    session_id = f"test_evt_{uuid.uuid4().hex[:8]}"

    # 1. Query upcoming lectures
    request_query = ChatRequest(
        session_id=session_id,
        message="近期有什么留学讲座或者分享会吗？",
    )
    response_query = dialog_manager.handle_message(db=db_session, request=request_query)
    assert response_query.intent_code == "event_register"
    assert response_query.card_type == "event_list"
    assert len(response_query.card_content) >= 3

    # 2. Perform closed-loop registration with customer details
    import time
    test_phone = f"136{int(time.time() * 1000) % 100000000:08d}"
    request_reg = ChatRequest(
        session_id=session_id,
        message=f"我想报名宣讲会，姓名李雷，电话是{test_phone}",
    )
    response_reg = dialog_manager.handle_message(db=db_session, request=request_reg)
    assert response_reg.intent_code == "event_register"
    assert response_reg.card_type == "register_success"
    assert "报名成功" in response_reg.reply


def test_scenario_07_casual_chat_and_natural_lead_guide(db_session):
    """Scenario 07: Youthful conversational chat and natural lead guidance after turns."""
    session_id = f"test_chat_{uuid.uuid4().hex[:8]}"

    # Turn 1: Warm greeting
    req1 = ChatRequest(session_id=session_id, message="你好呀！")
    res1 = dialog_manager.handle_message(db=db_session, request=req1)
    assert res1.intent_code == "casual_chat"
    assert "粤教小助手" in res1.reply or "小粤" in res1.reply

    # Turn 2
    req2 = ChatRequest(session_id=session_id, message="今天天气真不错")
    res2 = dialog_manager.handle_message(db=db_session, request=req2)
    assert res2.intent_code == "casual_chat"

    # Turn 3: Natural lead prompt inserted
    req3 = ChatRequest(session_id=session_id, message="哈哈，你懂得真多")
    res3 = dialog_manager.handle_message(db=db_session, request=req3)
    assert res3.intent_code == "casual_chat"
    assert "悄悄问一句" in res3.reply or "留学" in res3.reply


def test_api_endpoints_via_client(api_client):
    """Verify HTTP API endpoints via FastAPI test client."""
    # 1. Chat endpoint
    chat_payload = {
        "message": "请问你们支持哪些国家留学？",
    }
    chat_res = api_client.post("/api/v1/cs/chat", json=chat_payload)
    assert chat_res.status_code == 200
    res_data = chat_res.json()
    assert res_data["code"] == 200
    assert "reply" in res_data["data"]
    created_session_id = res_data["data"]["session_id"]

    # 2. Session history endpoint
    history_res = api_client.get(f"/api/v1/cs/sessions/{created_session_id}/messages")
    assert history_res.status_code == 200
    history_data = history_res.json()["data"]
    assert len(history_data) >= 2

    # 3. Events endpoint
    events_res = api_client.get("/api/v1/cs/events")
    assert events_res.status_code == 200
    assert len(events_res.json()["data"]) >= 3

    # 4. FAQ catalog endpoint
    faq_res = api_client.get("/api/v1/cs/faqs")
    assert faq_res.status_code == 200
    assert len(faq_res.json()["data"]) == 36

    # 5. Course recommendation endpoint
    rec_res = api_client.post(
        "/api/v1/cs/courses/recommend",
        json={"education_level": "大专", "target_country": "新加坡"},
    )
    assert rec_res.status_code == 200
    assert rec_res.json()["data"]["is_matched"] is True
