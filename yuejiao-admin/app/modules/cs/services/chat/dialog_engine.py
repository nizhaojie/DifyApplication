"""Dialog manager handling multi-turn conversation and 7-scenario execution."""

import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.modules.cs.crud.crud import (
    create_chat_message,
    create_chat_session,
    get_session_by_session_id,
    list_messages_by_session_id,
    update_session_activity,
)
from app.modules.cs.schemas.schemas import (
    ChatRequest,
    ChatResponse,
    CourseRecommendRequest,
    EventRegisterRequest,
)
from app.modules.cs.services.chat.intent_classifier import (
    SCENARIO_METADATA,
    intent_classifier,
)
from app.modules.cs.services.event.event_service import event_service
from app.modules.cs.services.rag.faq_engine import faq_engine
from app.modules.cs.services.rag.kb_engine import kb_engine
from app.modules.cs.services.recommend.course_matcher import course_matcher


class DialogManager:
    """Central conversation coordinator for Customer Service Agent."""

    def __init__(self):
        pass

    @staticmethod
    def _extract_registration_info(
        text_content: str,
    ) -> Tuple[Optional[str], Optional[str]]:
        """Extract customer name and phone number from natural language message."""
        phone_match = re.search(r"(1[3-9]\d{9}|1[3-9][0-9a-zA-Z]{9}|\d{8,12})", text_content)
        extracted_phone = phone_match.group(1) if phone_match else None

        name_match = re.search(
            r"(?:我是|叫|姓名(?:是|:|：)?|名字(?:是|:|：)?)\s*([\u4e00-\u9fa5]{2,4}?)(?=[,，.。 \t\r\n]|电话|$)",
            text_content,
        )
        extracted_name = name_match.group(1) if name_match else None

        return extracted_name, extracted_phone

    @staticmethod
    def _extract_recommend_criteria(
        text_content: str,
    ) -> CourseRecommendRequest:
        """Infer education level, destination country, and budget from query."""
        education_level = None
        for level in ["初中", "中专", "中职", "职高", "技校", "高中", "大专", "专科", "本科"]:
            if level in text_content:
                education_level = level
                break

        target_country = None
        if "德" in text_content:
            target_country = "德国"
        elif "新" in text_content:
            target_country = "新加坡"

        budget_max = None
        budget_match = re.search(
            r"(\d+)(?:\s*(?:万|w|W|万元))", text_content
        )
        if budget_match:
            budget_max = float(budget_match.group(1)) * 10000.0

        return CourseRecommendRequest(
            education_level=education_level,
            target_country=target_country,
            budget_max=budget_max,
            recommend_limit=3,
        )

    def handle_message(self, db: Session, request: ChatRequest) -> ChatResponse:
        """Process incoming user utterance through the 7-intent conversation pipeline."""
        start_time = time.perf_counter()

        # 1. Manage session lifecycle
        session_id = request.session_id or f"cs_sess_{uuid.uuid4().hex[:12]}"
        existing_session = get_session_by_session_id(db, session_id)
        if not existing_session:
            create_chat_session(
                db=db,
                session_id=session_id,
                visitor_name=request.visitor_name,
                visitor_contact=request.visitor_contact,
            )
        else:
            update_session_activity(
                db=db,
                session_id=session_id,
                visitor_name=request.visitor_name,
                visitor_contact=request.visitor_contact,
            )

        # Count previous message rounds in session
        previous_messages = list_messages_by_session_id(db, session_id)
        user_turn_count = (
            len([m for m in previous_messages if m.role == "user"]) + 1
        )

        user_message_text = request.message.strip()

        # 2. Classify intent
        classification = intent_classifier.classify(user_message_text)
        intent_code = classification.intent_code
        intent_name = classification.intent_name

        reply_text = ""
        source_references: List[str] = []
        card_type: Optional[str] = None
        card_content: Optional[Any] = None

        # 3. Route to dedicated scenario handler
        if intent_code == "faq":
            faq_match = faq_engine.match(user_message_text, confidence_threshold=0.55)
            if faq_match.is_matched and faq_match.answer:
                reply_text = (
                    f"【标准问答】{faq_match.answer}\n\n"
                    "如果您对流程细节或材料准备有进一步疑问，小粤随时为您解答哦~"
                )
                source_references.append("粤教服务标准FAQ问答库 (36条)")
            else:
                kb_chunks = kb_engine.search(db, user_message_text, top_k=2)
                if kb_chunks:
                    reply_text = kb_chunks[0].content
                    source_references.append(kb_chunks[0].source_file or "业务知识库")
                else:
                    reply_text = (
                        "关于该项常见咨询，请以官方最新发布的指引为准，"
                        "或者您可以留下联系方式，由我们的专业顾问老师为您一对一解答~"
                    )

        elif intent_code == "company_inquiry":
            kb_chunks = kb_engine.search(
                db, user_message_text, category_filter="company_info", top_k=2
            )
            if kb_chunks:
                reply_text = (
                    f"{kb_chunks[0].content}\n\n"
                    "粤教服务始终坚持以国企担当为广大学员搭建专业可靠的国际化桥梁！"
                )
                source_references.append(
                    kb_chunks[0].source_file or "企业信息.docx"
                )
            else:
                reply_text = (
                    "广东教育国际交流服务中心有限公司（粤教服务）是深耕国际化教育40余年的专业省属国企平台，"
                    "涵盖中德双元制、国际本硕升学、学历提升等核心业务。关于机构详情，官方公告均可查验~"
                )
                source_references.append("企业信息.docx")

        elif intent_code == "business_query":
            kb_chunks = kb_engine.search(
                db, user_message_text, category_filter="business", top_k=2
            )
            if kb_chunks:
                reply_text = (
                    f"{kb_chunks[0].content}\n\n"
                    "小粤建议：您也可以告诉我您的学历起点或意向专业，我为您定制专属的学制与升学路线！"
                )
                source_references.append(
                    kb_chunks[0].source_file or "核心业务文档.docx"
                )
            else:
                reply_text = (
                    "我们主营德国双元制带薪实训、新加坡2+2/0.5+2国际定向本科直通车、"
                    "1年制专升本/本升硕以及高薪就业班。请问您对哪种培养模式最感兴趣呢？"
                )

        elif intent_code == "policy_query":
            kb_chunks = kb_engine.search(
                db, user_message_text, category_filter="policy", top_k=2
            )
            policy_body = ""
            if kb_chunks:
                policy_body = kb_chunks[0].content
                source_references.append(
                    kb_chunks[0].source_file or "留学政策指南.docx"
                )
            else:
                policy_body = (
                    "各国签证与居留政策各具特点：例如德国双元制需达到欧标B1要求后匹配带薪实习合同，"
                    "工作满2年可申请永居；新加坡留学学历受中国教育部留学服务中心认证，留学生可享受一线城市落户与创业补贴。"
                )
            reply_text = (
                f"{policy_body}\n\n"
                "【防幻觉与时效声明】：海外留学与使领馆签证政策具有动态调整特性，"
                "上述解读供参考，具体以官方最新发布规定为准。"
            )

        elif intent_code == "course_recommend":
            inferred_criteria = self._extract_recommend_criteria(user_message_text)
            recommend_result = course_matcher.recommend(db, inferred_criteria)
            if recommend_result.is_matched:
                reply_text = (
                    f"小粤为您精选了匹配度最高的留学/升学方案：\n\n"
                    f"{recommend_result.recommendation_rationale}\n\n"
                )
                if recommend_result.follow_up_suggestion:
                    reply_text += f"{recommend_result.follow_up_suggestion}\n"
                reply_text += "您可以点击下方项目卡片进一步了解学制与申请要求，或直接发起咨询预约！"

                card_type = "course_list"
                card_content = [
                    course.model_dump()
                    for course in recommend_result.recommended_courses
                ]
            else:
                reply_text = (
                    f"{recommend_result.recommendation_rationale}\n"
                    f"{recommend_result.follow_up_suggestion}"
                )

        elif intent_code == "event_register":
            parsed_name, parsed_phone = self._extract_registration_info(
                user_message_text
            )
            if not parsed_name and request.visitor_name:
                parsed_name = request.visitor_name

            active_events = event_service.list_active_events(db)

            # Check if user is inquiring about their existing registration status (Chat Memory)
            query_status_indicators = [
                "报名了吗", "报上名了吗", "查报名", "报名状态", "报名成功了吗",
                "查一下报名", "我的报名", "我报了哪", "有没有报上", "查预约", "查询预约",
            ]
            is_status_query = any(token in user_message_text for token in query_status_indicators)

            if is_status_query:
                # 1. Look for phone in current message or request
                target_phone = parsed_phone or (
                    request.visitor_contact.strip() if request.visitor_contact else None
                )
                # 2. Look for phone in previous conversation messages within this session (Session Memory)
                if not target_phone:
                    for prev_msg in reversed(previous_messages):
                        phone_match = re.search(r"1[3-9]\d{9}", prev_msg.content)
                        if phone_match:
                            target_phone = phone_match.group(0)
                            break

                if target_phone:
                    my_regs = event_service.query_user_registrations(db, contact_info=target_phone)
                    if my_regs:
                        latest_reg = my_regs[0]
                        reply_text = (
                            f"【预约查询结果】小粤已为您核验到有效的活动报名记录：\n\n"
                            f"🎯 讲座名称：【{latest_reg['event_name']}】\n"
                            f"📅 开场时间：{latest_reg['start_time']}\n"
                            f"📍 活动地点：{latest_reg['location']}\n"
                            f"👤 预约人：{latest_reg['customer_name']}（{latest_reg['contact_info']}）\n\n"
                            f"系统已锁定席位，顾问老师将在活动前与您取得联系，请准时参加哦！"
                        )
                        card_type = "register_success"
                        card_content = latest_reg
                    else:
                        reply_text = (
                            f"小粤在系统中核验了手机号【{target_phone}】，暂未查询到有效的活动预约记录。\n"
                            f"近期精选讲座排期如下，您可以直接在对话中回复【我想报名宣讲会，姓名，手机号】，我帮您秒级锁定义务席位~"
                        )
                        card_type = "event_list"
                        card_content = [ev.model_dump() for ev in active_events]
                else:
                    reply_text = (
                        "小粤非常乐意为您查询活动预约状态！\n"
                        "请在对话中发送您报名时填写的手机号（例如：【查询报名 13812345678】），我立刻为您检索后台数据~"
                    )

            elif parsed_phone and active_events:
                customer_name = parsed_name or "意向学员"
                # Pick earliest event that has seats available, or first event
                available_events = [ev for ev in active_events if ev.has_available_seats]
                target_event = available_events[0] if available_events else active_events[0]
                reg_response = event_service.register(
                    db=db,
                    payload=EventRegisterRequest(
                        event_id=target_event.id,
                        customer_name=customer_name,
                        contact_info=parsed_phone,
                    ),
                )
                reply_text = reg_response.message
                if reg_response.is_success:
                    card_type = "register_success"
                    card_content = {
                        "event_name": reg_response.event_name,
                        "customer_name": customer_name,
                        "contact_info": parsed_phone,
                    }
            else:
                reply_text = (
                    "近期精选讲座与说明会排期如下，支持一键预约报名！\n"
                    "您也可以直接在对话中回复【我想报名宣讲会，姓名，手机号】，我帮您立刻登记席位~"
                )
                card_type = "event_list"
                card_content = [ev.model_dump() for ev in active_events]

        else:  # casual_chat
            friendly_replies = [
                "哈喽~ 我是粤教小助手（小粤同学）！有什么升学或留学方面的问题，都可以随时问我哟~",
                "在呢在呢！无论您是想了解德国免学费双元制，还是新加坡名校直通车，小粤都能秒级为您答疑解惑！",
                "收到！今天也是元气满满的一天呀~ 请问有什么可以帮您的呢？",
            ]
            chosen_reply = friendly_replies[user_turn_count % len(friendly_replies)]

            if user_turn_count >= 3:
                chosen_reply += (
                    "\n\n悄悄问一句~ 宝子最近有考虑过出国深造或者带薪实训的计划吗？"
                    "不论是免学费的德国双元制还是快速拿名校本硕的新加坡项目，随时可以跟我聊聊呀！"
                )
            reply_text = chosen_reply

        # 4. Compute response time and tokens
        elapsed_time_ms = int((time.perf_counter() - start_time) * 1000)
        approx_tokens = (len(user_message_text) + len(reply_text)) // 2

        # 5. Persist to chat_message table
        create_chat_message(
            db=db,
            session_id=session_id,
            role="user",
            content=user_message_text,
            intent=intent_code,
        )

        create_chat_message(
            db=db,
            session_id=session_id,
            role="assistant",
            content=reply_text,
            intent=intent_code,
            tokens_used=approx_tokens,
            response_time_ms=elapsed_time_ms,
        )

        return ChatResponse(
            session_id=session_id,
            reply=reply_text,
            intent_code=intent_code,
            intent_name=intent_name,
            source_references=source_references,
            card_type=card_type,
            card_content=card_content,
            tokens_used=approx_tokens,
            response_time_ms=elapsed_time_ms,
        )


dialog_manager = DialogManager()
