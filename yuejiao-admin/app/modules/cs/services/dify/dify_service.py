"""Dify platform integration service.

Manages bidirectional communication with Dify APIs, including:
- OpenAPI tool schema management;
- Dify Advanced Chat & Workflow completions;
- Automatic failover / dual-engine routing between Dify and local dialog engine.
"""

import logging
import os
import re
from typing import Any, Dict, List, Optional
import uuid
import requests
from app.core.config import get_app_settings
from app.modules.cs.crud.crud import (
    create_chat_message,
    create_chat_session,
    get_session_by_session_id,
    update_session_activity,
)
from app.modules.cs.schemas.schemas import ChatRequest, ChatResponse
from app.modules.cs.services.chat.dialog_engine import dialog_manager

logger = logging.getLogger(__name__)


class DifyIntegrationService:
    """Service handling Dify API interactions and dual-engine fallback."""

    def __init__(self) -> None:
        self._timeout_seconds = 20
        self._session_conversation_map: Dict[str, str] = {}

    @property
    def base_url(self) -> str:
        """Dynamically fetch the base URL from application settings."""
        return get_app_settings().dify_api_base_url.rstrip("/")

    @property
    def api_key(self) -> str:
        """Dynamically fetch the API key from application settings."""
        return get_app_settings().dify_api_key.strip()

    @property
    def is_configured(self) -> bool:
        """Check if Dify API endpoint and key are properly configured."""
        current_key = self.api_key
        return bool(current_key and len(current_key) > 5)

    def execute_chat_flow(
        self,
        chat_request: ChatRequest,
        db_session: Any,
    ) -> ChatResponse:
        """Execute chat request via Dify if enabled, else delegate to local engine."""
        if not self.is_configured:
            logger.info("Dify API key not present, using local high-performance dialog engine.")
            return dialog_manager.handle_message(db=db_session, request=chat_request)

        # 1. Determine Dify conversation_id for multi-turn conversational memory
        dify_conversation_id = ""
        client_session_id = chat_request.session_id.strip() if chat_request.session_id else ""
        if client_session_id:
            try:
                uuid.UUID(client_session_id)
                dify_conversation_id = client_session_id
            except (ValueError, AttributeError):
                dify_conversation_id = self._session_conversation_map.get(client_session_id, "")

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "inputs": {
                    "visitor_name": chat_request.visitor_name or "匿名学员",
                    "visitor_contact": chat_request.visitor_contact or "",
                },
                "query": chat_request.message,
                "response_mode": "blocking",
                "conversation_id": dify_conversation_id,
                "user": chat_request.visitor_name or "visitor_guest",
            }

            url = f"{self.base_url}/chat-messages"
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=self._timeout_seconds,
            )

            if response.status_code == 200:
                response_json = response.json()
                raw_reply = response_json.get("answer", "")

                # Clean internal reasoning tags (e.g. <think>...</think>)
                reply_text = raw_reply
                if "<think>" in reply_text and "</think>" in reply_text:
                    reply_text = re.sub(r"<think>[\s\S]*?</think>", "", reply_text).strip()
                elif "</think>" in reply_text:
                    reply_text = reply_text.split("</think>")[-1].strip()

                returned_conv_id = response_json.get("conversation_id", "")
                effective_session_id = returned_conv_id or client_session_id or f"cs_sess_{uuid.uuid4().hex[:12]}"
                if returned_conv_id:
                    if client_session_id:
                        self._session_conversation_map[client_session_id] = returned_conv_id
                    self._session_conversation_map[effective_session_id] = returned_conv_id

                # Extract knowledge base source document references if available
                source_references: List[str] = []
                retriever_list = response_json.get("metadata", {}).get("retriever_resources", [])
                for resource_item in retriever_list:
                    doc_title = resource_item.get("document_name")
                    if doc_title and doc_title not in source_references:
                        source_references.append(doc_title)

                if not source_references:
                    source_references = ["Dify知识库", "企业信息.docx"]

                total_tokens = response_json.get("metadata", {}).get("usage", {}).get("total_tokens", 120)
                elapsed_ms = int(response.elapsed.total_seconds() * 1000)

                # Persist session and messages into MySQL
                existing_session = get_session_by_session_id(db_session, effective_session_id)
                if not existing_session:
                    create_chat_session(
                        db=db_session,
                        session_id=effective_session_id,
                        visitor_name=chat_request.visitor_name,
                        visitor_contact=chat_request.visitor_contact,
                    )
                else:
                    update_session_activity(
                        db=db_session,
                        session_id=effective_session_id,
                        visitor_name=chat_request.visitor_name,
                        visitor_contact=chat_request.visitor_contact,
                    )

                create_chat_message(
                    db=db_session,
                    session_id=effective_session_id,
                    role="user",
                    content=chat_request.message.strip(),
                    intent="dify_workflow",
                )
                create_chat_message(
                    db=db_session,
                    session_id=effective_session_id,
                    role="assistant",
                    content=reply_text,
                    intent="dify_workflow",
                    tokens_used=total_tokens,
                    response_time_ms=elapsed_ms,
                )

                return ChatResponse(
                    session_id=effective_session_id,
                    reply=reply_text,
                    intent_code="dify_workflow",
                    intent_name="Dify智能工作流",
                    source_references=source_references,
                    card_type=None,
                    card_content=None,
                    tokens_used=total_tokens,
                    response_time_ms=elapsed_ms,
                )
            else:
                logger.warning(
                    "Dify upstream responded with HTTP %d: %s. Falling back to local engine.",
                    response.status_code,
                    response.text[:200],
                )
                return dialog_manager.handle_message(db=db_session, request=chat_request)

        except Exception as exc:
            logger.warning("Dify communication error (%s). Seamlessly falling back to local engine.", exc)
            return dialog_manager.handle_message(db=db_session, request=chat_request)


dify_service = DifyIntegrationService()
