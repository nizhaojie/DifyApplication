import re
from typing import Any

import httpx

from app.core.config import settings
from app.utils.log import logger

_THINK_RE = re.compile(r"<think\b[^>]*>.*?</think>", re.I | re.S)
_REASON_COMMENT_RE = re.compile(r"<!--\s*dify-deepseek-reasoning\s*-->", re.I)


def _clean_answer(text: str) -> str:
    cleaned = _THINK_RE.sub("", text or "")
    cleaned = _REASON_COMMENT_RE.sub("", cleaned)
    return cleaned.strip()


class DifyClient:
    def enabled(self) -> bool:
        return bool(settings.dify_enterprise_api_key)

    async def chat(
        self,
        query: str,
        *,
        user: str,
        conversation_id: str | None = None,
        inputs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = settings.dify_base_url.rstrip("/") + "/chat-messages"
        payload: dict[str, Any] = {
            "inputs": inputs or {},
            "query": query,
            "response_mode": "blocking",
            "user": user,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id
        headers = {
            "Authorization": f"Bearer {settings.dify_enterprise_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code >= 400:
                raise RuntimeError(f"dify HTTP {response.status_code}: {response.text[:500]}")
            data = response.json()
        answer = _clean_answer(data.get("answer") or "")
        logger.info("dify chat ok user=%s conversation=%s", user, data.get("conversation_id"))
        return {
            "reply": answer,
            "conversation_id": data.get("conversation_id"),
            "source": "dify",
            "intent": None,
            "raw": {"id": data.get("id"), "task_id": data.get("task_id")},
        }


dify_client = DifyClient()
