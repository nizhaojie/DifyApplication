from typing import Any


def ok(data: Any = None, message: str = "ok", total: int | None = None) -> dict[str, Any]:
    return {"code": 200, "message": message, "data": data, "total": total}


def fail(message: str, code: int = 400, data: Any = None) -> dict[str, Any]:
    return {"code": code, "message": message, "data": data, "total": None}
