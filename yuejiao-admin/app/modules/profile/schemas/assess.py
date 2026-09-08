"""研判接口出入参模型。"""

from pydantic import BaseModel


class ProgramCandidate(BaseModel):
    programs: list[str] = []
    category: str | None = None
    rationale: str | None = None


class AssessmentOut(BaseModel):
    product_line: str
    rule_name: str | None = None
    match_result: str                       # matched / partial / not_matched
    match_score: float
    matched_labels: list[str] = []
    candidate_programs: list[ProgramCandidate] = []


class AssessResponse(BaseModel):
    id: int | None = None
    source_id: int | None = None
    customer_name: str | None = None
    match_result: str | None = None
    matched_product: str | None = None
    match_score: float | None = None
    match_reason: str | None = None
    recommended_programs: list[str] | None = None
    background_info: dict | None = None
    assessments: list[AssessmentOut] = []


class ProfileOut(BaseModel):
    """列表项（轻量）。"""

    id: int
    customer_name: str | None = None
    match_result: str | None = None
    matched_product: str | None = None
    match_score: float | None = None
    create_time: str | None = None
