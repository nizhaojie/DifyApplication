"""Customer Service 7-intent classification engine."""

import re
from typing import NamedTuple
from app.modules.cs.services.rag.faq_engine import faq_engine


class IntentClassificationResult(NamedTuple):
    """Result of intent classification."""

    intent_code: str
    intent_name: str
    confidence: float


# Metadata for 7 customer service scenarios
SCENARIO_METADATA = {
    "company_inquiry": {
        "name": "公司信息咨询",
        "keywords": [
            "公司背景", "粤教服务", "粤教国际", "机构背景", "资质", "国企", "总部", "地址",
            "校区", "发展历程", "创立", "部门架构", "事业部", "联系方式", "简介", "介绍一下公司",
        ],
    },
    "business_query": {
        "name": "公司业务查询",
        "keywords": [
            "双元制培养模式", "德国双元制", "新加坡定向", "工学交替", "培养模式",
            "带薪实训", "带薪实习", "酒店运营", "航空运营", "主营业务", "研学",
        ],
    },
    "policy_query": {
        "name": "留学政策查询",
        "keywords": [
            "签证要求", "工作签证", "工签", "绿卡", "永居", "移民政策", "留学政策", "政策",
            "留服认证", "教育部认证", "落户政策", "使领馆", "B1要求",
        ],
    },
    "faq": {
        "name": "常见问题解答",
        "keywords": [
            "对公账户", "开户行", "缴费账号", "银行账户", "退费", "多少钱",
            "报名流程", "申请流程", "材料", "缴费", "怎么收费", "学费多少", "汇款",
        ],
    },
    "course_recommend": {
        "name": "课程项目推荐",
        "keywords": [
            "推荐", "选课", "适合什么", "读什么专业", "有什么课程", "初中毕业",
            "高中毕业", "大专想", "本科毕业", "预算", "想出国", "推荐项目",
        ],
    },
    "event_register": {
        "name": "活动报名闭环",
        "keywords": [
            "报名", "预约", "活动", "讲座", "宣讲会", "分享会", "见面会", "沙龙",
        ],
    },
    "casual_chat": {
        "name": "日常闲聊互动",
        "keywords": [
            "你好", "您好", "在吗", "早上好", "下午好", "晚上好", "hello", "hi",
            "谢谢", "多谢", "再见", "拜拜", "无聊", "心情不好", "累了", "开心",
            "谁开发的", "你叫什么", "你真棒", "哈哈",
        ],
    },
}


class IntentClassifier:
    """Multi-tiered intent classifier matching 7 customer service scenarios."""

    def __init__(self):
        pass

    def classify(self, user_message: str) -> IntentClassificationResult:
        """Classify user utterance into one of the 7 core intent codes."""
        cleaned_text = user_message.strip().lower()
        if not cleaned_text:
            return IntentClassificationResult(
                intent_code="casual_chat",
                intent_name="日常闲聊互动",
                confidence=1.0,
            )

        # 1. Event Registration has highest priority when user wants to signup or check events
        event_indicators = ["我要报名", "想报名", "报名宣讲", "报名活动", "预约讲座", "近期讲座", "近期活动", "有什么讲座", "分享会"]
        if any(token in cleaned_text for token in event_indicators):
            return IntentClassificationResult(
                intent_code="event_register",
                intent_name="活动报名闭环",
                confidence=0.95,
            )

        # 2. Course Recommendation
        recommend_indicators = ["推荐", "适合什么", "我想读", "想学什么", "有什么课程", "初中毕业", "高中毕业", "大专想", "预算"]
        if any(token in cleaned_text for token in recommend_indicators):
            return IntentClassificationResult(
                intent_code="course_recommend",
                intent_name="课程项目推荐",
                confidence=0.93,
            )

        # 3. Policy Query
        policy_indicators = ["签证", "工签", "移民", "永居", "工作许可", "政策", "留服认证", "教育部认证", "落户"]
        if any(token in cleaned_text for token in policy_indicators):
            return IntentClassificationResult(
                intent_code="policy_query",
                intent_name="留学政策查询",
                confidence=0.90,
            )

        # 4. Company Background Query
        company_indicators = ["背景", "资质", "部门架构", "校区分布", "简介", "介绍一下公司", "成立时间", "国企背景", "是国企吗"]
        if any(token in cleaned_text for token in company_indicators) or ("粤教" in cleaned_text and "什么" in cleaned_text and "简称" not in cleaned_text):
            return IntentClassificationResult(
                intent_code="company_inquiry",
                intent_name="公司信息咨询",
                confidence=0.88,
            )

        # 5. Direct FAQ Matching
        faq_match = faq_engine.match(user_message, confidence_threshold=0.60)
        if faq_match.is_matched:
            return IntentClassificationResult(
                intent_code="faq",
                intent_name="常见问题解答",
                confidence=faq_match.confidence_score,
            )

        # 6. Business Query (dual system, Singapore programs)
        biz_indicators = ["双元制", "培养模式", "主营业务", "定向培养", "工学交替", "本硕连读", "带薪实习"]
        if any(token in cleaned_text for token in biz_indicators):
            return IntentClassificationResult(
                intent_code="business_query",
                intent_name="公司业务查询",
                confidence=0.85,
            )

        # 7. Keyword scoring across all categories
        scores = {}
        for code, meta in SCENARIO_METADATA.items():
            score = 0
            for kw in meta["keywords"]:
                if kw.lower() in cleaned_text:
                    score += len(kw)
            scores[code] = score

        best_intent = max(scores, key=scores.get)
        highest_score = scores[best_intent]

        if highest_score > 0:
            return IntentClassificationResult(
                intent_code=best_intent,
                intent_name=SCENARIO_METADATA[best_intent]["name"],
                confidence=min(0.85, 0.50 + highest_score * 0.05),
            )

        # 8. Fallback default: casual_chat
        return IntentClassificationResult(
            intent_code="casual_chat",
            intent_name="日常闲聊互动",
            confidence=0.50,
        )


intent_classifier = IntentClassifier()
