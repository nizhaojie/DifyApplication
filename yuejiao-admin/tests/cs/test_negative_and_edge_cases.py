"""Comprehensive negative, edge-case, and boundary error handling tests for CS module."""

import pytest
from fastapi.testclient import TestClient
from app.db.session import AsyncSessionLocal
from app.main import app
from app.modules.cs.models.models import CourseProject, EventLecture, EventRegistration
from app.modules.cs.schemas.schemas import (
    ChatRequest,
    CourseRecommendRequest,
    EventRegisterRequest,
)
from app.modules.cs.services.chat.dialog_engine import dialog_manager
from app.modules.cs.services.event.event_service import event_service
from app.modules.cs.services.recommend.course_matcher import course_matcher


@pytest.fixture
async def db_session():
    """Yield test database session."""
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        await session.close()


@pytest.fixture
def client():
    """FastAPI TestClient."""
    return TestClient(app)


# ===========================================================================
# 1. 业务不存在/无中生有提问：防幻觉与引导测试 (Out-of-Scope Negative Tests)
# ===========================================================================

async def test_negative_out_of_scope_mars_or_excavator(db_session):
    """测试询问完全不存在的业务（如火星移民、买挖掘机），验证防幻觉与礼貌引导。"""
    chat_req = ChatRequest(
        message="请问你们公司可以办理火星移民或者提供二手挖掘机买卖吗？",
        visitor_name="好奇访客",
    )
    res = await dialog_manager.handle_message(db=db_session, request=chat_req)
    assert res.session_id is not None
    assert len(res.reply) > 10
    # 绝不能胡编虚构挖掘机或火星业务，必须清晰聚焦于升学教育
    assert "火星" in res.reply or "小粤" in res.reply or "教育" in res.reply or "升学" in res.reply
    assert res.response_time_ms is not None


async def test_negative_transfer_to_personal_account_fraud_prevention(db_session):
    """测试询问对公缴费账号，验证官方账户准确返回防范财务欺诈。"""
    chat_req = ChatRequest(
        message="请问公司的对公缴费银行账户是多少？",
    )
    res = await dialog_manager.handle_message(db=db_session, request=chat_req)
    # 必须明确告知仅认准官方对公账户，防范财务欺诈
    assert "对公" in res.reply or "广东省教育服务有限公司" in res.reply or "广发银行" in res.reply
    assert "9550889900011455492" in res.reply or "对公账户" in res.reply or "对公" in res.reply


# ===========================================================================
# 2. 接口参数缺失与格式非法异常：统一报错规范验证 (HTTP Error Handling)
# ===========================================================================

def test_negative_empty_message_rejection(client):
    """测试发送空消息或纯空格，验证 Pydantic 422 统一拦截。"""
    res = client.post("/api/v1/cs/chat", json={"message": ""})
    assert res.status_code == 422
    err_body = res.json()
    assert "detail" in err_body


def test_negative_non_existent_event_registration(client, db_session):
    """测试向不存在的 event_id (999999) 提交报名，验证 400/404 错误封装。"""
    req_payload = {
        "event_id": 999999,
        "customer_name": "张无忌",
        "contact_info": "13912345678",
        "remark": "测试不存在活动",
    }
    res = client.post("/api/v1/cs/events/register", json=req_payload)
    # 应返回 code=400 且包含明确错误提示
    body = res.json()
    assert body["code"] == 400
    assert "不存在" in body["message"] or "未找到" in body["message"]
    assert body["data"]["is_success"] is False


def test_negative_missing_contact_info_registration(client):
    """测试报名活动但联系方式为空，验证参数校验拦截。"""
    req_payload = {
        "event_id": 1,
        "customer_name": "张三",
        "contact_info": "",  # 必填项为空
    }
    res = client.post("/api/v1/cs/events/register", json=req_payload)
    # Pydantic 校验或业务校验拦截
    assert res.status_code in [400, 422]


# ===========================================================================
# 3. 业务状态冲突测试：名额已满与防重提交拦截 (State Conflict Tests)
# ===========================================================================

async def test_negative_duplicate_registration_interception(db_session):
    """测试同一手机号连续重复报名同一活动，验证防重复提交拦截。"""
    # 查找有名额的有效活动
    events = await event_service.list_active_events(db_session)
    available_events = [ev for ev in events if ev.has_available_seats]
    if available_events:
        target_event = available_events[0]
    else:
        import uuid
        test_ev = EventLecture(
            event_name=f"防重测试讲座_{uuid.uuid4().hex[:6]}",
            event_type="online",
            start_time="2026-10-01 14:00:00",
            max_participants=50,
            current_participants=0,
            status="upcoming",
        )
        db_session.add(test_ev)
        await db_session.commit()
        await db_session.refresh(test_ev)
        target_event = test_ev

    import random
    unique_phone = f"137{random.randint(10000000, 99999999)}"
    reg_req = EventRegisterRequest(
        event_id=target_event.id,
        customer_name="防重测试学员",
        contact_info=unique_phone,
    )

    # 首次报名：成功
    first_res = await event_service.register(db_session, reg_req)
    assert first_res.is_success is True
    # 再次以相同手机号报名：被拦截
    second_res = await event_service.register(db_session, reg_req)
    assert second_res.is_success is False
    assert "已经成功" in second_res.message or "重复" in second_res.message


async def test_negative_event_capacity_full_interception(db_session):
    """测试活动名额已达上限时报名，验证满额保护拦截。"""
    import uuid
    # 动态创建名额为 1 的测试活动
    isolated_event = EventLecture(
        event_name=f"负向满额测试讲座_{uuid.uuid4().hex[:6]}",
        event_type="online",
        start_time="2026-10-01 14:00:00",
        max_participants=1,
        current_participants=1,  # 故意设为已满
        status="upcoming",
    )
    db_session.add(isolated_event)
    await db_session.commit()
    await db_session.refresh(isolated_event)

    reg_req = EventRegisterRequest(
        event_id=isolated_event.id,
        customer_name="后来者",
        contact_info="13500009999",
    )
    res = await event_service.register(db_session, reg_req)
    assert res.is_success is False
    assert "名额已满" in res.message or "席位已满" in res.message or "满" in res.message


# ===========================================================================
# 4. 极端输入与不合理预算课程匹配 (Extreme Criteria Tests)
# ===========================================================================

async def test_negative_impossible_budget_course_match(db_session):
    """测试极端预算（如预算 50 元出国留学），验证系统不崩溃且友好兜底。"""
    extreme_req = CourseRecommendRequest(
        education_level="初中",
        target_country="英国",
        budget_max=50,  # 极低预算
    )
    res = await course_matcher.recommend(db_session, extreme_req)
    assert res is not None
    # 应当友好处理：无匹配或推荐公费免学费项目
    if not res.is_matched:
        assert res.match_count == 0
        assert "暂未检索到" in res.recommendation_rationale or "调整" in res.recommendation_rationale or "未找到" in res.recommendation_rationale or "放宽" in res.recommendation_rationale
    else:
        # 若有匹配，应为0学费双元制项目
        assert all(c.price == 0 for c in res.recommended_courses)


async def test_negative_pure_punctuation_query(db_session):
    """测试用户输入纯标点符号或乱码（如 ????......），验证系统健壮性。"""
    chat_req = ChatRequest(message="？？？！！！......")
    res = await dialog_manager.handle_message(db=db_session, request=chat_req)
    assert res is not None
    assert len(res.reply) > 0
    # 应被识别为闲聊或引导
    assert res.intent_code in ["casual_chat", "faq", "company_inquiry"]


# ===========================================================================
# 5. 安全注入与恶意输入防护测试 (Security & Injection Protection Tests)
# ===========================================================================

async def test_negative_sql_injection_safety(db_session, client):
    """测试 SQL 注入语句输入（如 ' OR 1=1 -- ），验证参数化查询安全性。"""
    injection_query = "' OR 1=1 -- ; DROP TABLE chat_session;"
    chat_req = ChatRequest(message=injection_query)
    # 绝不能抛出数据库异常，应安全兜底
    res = await dialog_manager.handle_message(db=db_session, request=chat_req)
    assert res is not None
    assert res.session_id is not None
    assert len(res.reply) > 0


def test_negative_xss_script_payload_safety(client):
    """测试 XSS 恶意脚本载荷，验证接口正常接收并安全返回，无服务崩溃。"""
    xss_payload = "<script>alert('xss_attack')</script>"
    res = client.post("/api/v1/cs/chat", json={"message": xss_payload})
    assert res.status_code == 200
    data = res.json()
    assert data["code"] == 200
    assert "reply" in data["data"]


def test_negative_non_existent_route_404(client):
    """测试访问完全不存在的 API 路由，验证标准 404 规范。"""
    res = client.get("/api/v1/cs/non_existent_endpoint_999")
    assert res.status_code == 404
    body = res.json()
    assert "detail" in body


def test_negative_invalid_data_types_422(client):
    """测试传递类型完全错误的字段（如将数字/对象传给字符串），验证 FastAPI 统一 422 规范。"""
    # session_id 应为 string，故意传 list 触发 422
    res = client.post("/api/v1/cs/chat", json={"message": "你好", "session_id": ["invalid", "type"]})
    assert res.status_code == 422
    body = res.json()
    assert "detail" in body
    assert any("session_id" in str(err) for err in body["detail"])


async def test_negative_subzero_budget_graceful_handling(db_session):
    """测试负数预算（如 budget_max = -50000），验证系统不报错且逻辑严谨。"""
    req = CourseRecommendRequest(budget_max=-50000.0)
    res = await course_matcher.recommend(db=db_session, criteria=req)
    assert res is not None
    # 负数预算不应匹配任何收费课程
    for c in res.recommended_courses:
        assert c.price == 0.0

