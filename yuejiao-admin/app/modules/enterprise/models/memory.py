"""Conversation memory models for the enterprise module.

``chat_session`` / ``chat_message`` are owned by the cs module
(app/modules/cs/models/models.py) — this file only re-exports them so the
enterprise module keeps a single shared table definition.
"""

from app.modules.cs.models.models import ChatMessage, ChatSession

__all__ = ["ChatSession", "ChatMessage"]
