from typing import Any

import httpx

from app.core.config import settings


class StudentDifyClient:
    """Adapter for the three student-facing Dify applications."""

    def __init__(self, scene: str) -> None:
        configurations = {
            "psych": (
                settings.dify_student_psych_base_url or settings.dify_psych_base_url,
                settings.dify_student_psych_api_key or settings.dify_psych_api_key,
            ),
            "life": (
                settings.dify_student_life_base_url or settings.dify_life_base_url,
                settings.dify_student_life_api_key or settings.dify_life_api_key,
            ),
            "program": (
                settings.dify_student_program_base_url or settings.dify_program_base_url,
                settings.dify_student_program_api_key or settings.dify_program_api_key,
            ),
        }
        if scene not in configurations:
            raise ValueError(f"Unsupported student assistant scene: {scene}")
        base_url, api_key = configurations[scene]
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.api_key = api_key

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key)

    async def chat(self, query: str, user: str, conversation_id: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"inputs": {}, "query": query, "response_mode": "blocking", "user": user}
        if conversation_id:
            payload["conversation_id"] = conversation_id
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
            response = await client.post(
                "/chat-messages",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            response.raise_for_status()
            return response.json()
