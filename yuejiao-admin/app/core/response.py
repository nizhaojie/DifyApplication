"""Unified API response helpers.

All modules share the same envelope: ``{"code", "message", "data", "total"}``,
which matches the frontend ``Envelope`` interface (react-frontend/src/api/http.ts).
"""


from typing import Any


def ok(data: Any = None, message: str = "ok", total: int | None = None) -> dict[str, Any]:
    """Build standard dictionary success response."""
    return {"code": 200, "message": message, "data": data, "total": total}


def fail(message: str, code: int = 400, data: Any = None) -> dict[str, Any]:
    """Build standard dictionary error response."""
    return {"code": code, "message": message, "data": data, "total": None}
