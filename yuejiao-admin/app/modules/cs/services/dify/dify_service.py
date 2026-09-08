"""Dify platform integration service.

Manages bidirectional communication with Dify APIs, including:
- OpenAPI tool schema management;
- Dify Advanced Chat & Workflow completions;
- Automatic failover / dual-engine routing between Dify and local dialog engine.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests
from app.core.config import get_app_settings
from app.modules.cs.schemas.schemas import ChatRequest, ChatResponse
from app.modules.cs.services.chat.dialog_engine import dialog_manager

logger = logging.getLogger(__name__)


class DifyIntegrationService:
    """Service handling Dify API interactions and dual-engine fallback."""

    def __init__(self) -> None:
        self._settings = get_app_settings()
        self._base_url = self._settings.dify_api_base_url.rstrip("/")
        self._api_key = self._settings.dify_api_key.strip()
        self._timeout_seconds = 15

    @property
    def is_configured(self) -> bool:
        """Check if Dify API endpoint and key are properly configured."""
        return bool(self._api_key and len(self._api_key) > 5)

    def get_openapi_tool_dict(self) -> Dict[str, Any]:
        """Load and return the OpenAPI 3.0 tool schema dictionary."""
        candidate_paths = [
            Path(__file__).parent.parent.parent / "dify" / "tools" / "cs_openapi_tool.json",
            Path(r"c:\new\group-qukewei\dify\tools\cs_openapi_tool.json"),
        ]
        for path_item in candidate_paths:
            if path_item.exists():
                with open(path_item, "r", encoding="utf-8") as file_stream:
                    return json.load(file_stream)

        # Fallback inline schema summary if file not found
        return {
            "openapi": "3.0.0",
            "info": {"title": "Yuejiao CS Tools", "version": "1.0.0"},
            "paths": {},
        }

    def get_workflow_dsl_content(self) -> str:
        """Read and return the Dify Chatflow DSL YAML configuration string."""
        candidate_paths = [
            Path(r"c:\new\group-qukewei\dify\dsl\cs_agent_workflow.yml"),
            Path(__file__).parent.parent.parent / "dify" / "dsl" / "cs_agent_workflow.yml",
        ]
        for path_item in candidate_paths:
            if path_item.exists():
                with open(path_item, "r", encoding="utf-8") as file_stream:
                    return file_stream.read()
        return ""

    def execute_chat_flow(
        self,
        chat_request: ChatRequest,
        db_session: Any,
    ) -> ChatResponse:
        """Execute chat request via Dify if enabled, else delegate to local engine."""
        if not self.is_configured:
            logger.info("Dify API key not present, using local high-performance dialog engine.")
            return dialog_manager.handle_message(db=db_session, request=chat_request)

        try:
            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "inputs": {
                    "visitor_name": chat_request.visitor_name or "匿名学员",
                    "visitor_contact": chat_request.visitor_contact or "",
                },
                "query": chat_request.message,
                "response_mode": "blocking",
                "conversation_id": chat_request.session_id or "",
                "user": chat_request.visitor_name or "visitor_guest",
            }

            url = f"{self._base_url}/chat-messages"
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=self._timeout_seconds,
            )

            if response.status_code == 200:
                response_json = response.json()
                reply_text = response_json.get("answer", "")
                dify_conversation_id = response_json.get("conversation_id", chat_request.session_id)

                return ChatResponse(
                    session_id=dify_conversation_id or "cs_dify_session",
                    reply=reply_text,
                    intent_code="dify_workflow",
                    intent_name="Dify工作流引擎",
                    source_references=["Dify知识库", "企业信息.docx"],
                    card_type=None,
                    card_content=None,
                    tokens_used=response_json.get("metadata", {}).get("usage", {}).get("total_tokens", 120),
                    response_time_ms=int(response.elapsed.total_seconds() * 1000),
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
