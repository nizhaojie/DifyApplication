"""Unified API response models and helper functions."""

from datetime import datetime
from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel, Field

DataType = TypeVar("DataType")


class UnifiedResponse(BaseModel, Generic[DataType]):
    """Standard envelope for all API responses."""

    code: int = Field(default=200, description="Business status code (200=success)")
    message: str = Field(default="success", description="Response descriptive message")
    data: Optional[DataType] = Field(default=None, description="Response payload")
    timestamp: str = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="Response timestamp UTC",
    )


def make_success_response(
    payload: Any = None,
    message: str = "success",
    status_code: int = 200,
) -> UnifiedResponse[Any]:
    """Build a standard successful response envelope."""
    return UnifiedResponse[Any](
        code=status_code,
        message=message,
        data=payload,
    )


def make_error_response(
    message: str = "error",
    status_code: int = 400,
    payload: Any = None,
) -> UnifiedResponse[Any]:
    """Build a standard error response envelope."""
    return UnifiedResponse[Any](
        code=status_code,
        message=message,
        data=payload,
    )
