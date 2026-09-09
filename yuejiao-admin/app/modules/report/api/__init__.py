from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import get_report_app
from app.core.response import ok
from app.modules.report.application import (
    KIND_COMPLAINT_WEEKLY,
    KIND_CUSTOMER_OPS,
    KIND_DAILY_SUMMARY,
    KIND_PSYCH_WEEKLY,
    KIND_WEEKLY_SUMMARY,
    Report,
    ReportApplication,
)
from pydantic import BaseModel

router = APIRouter()

OPEN_KINDS = {
    KIND_CUSTOMER_OPS,
    KIND_COMPLAINT_WEEKLY,
    KIND_DAILY_SUMMARY,
    KIND_WEEKLY_SUMMARY,
    KIND_PSYCH_WEEKLY,
}


class GenerateBody(BaseModel):
    kind: str
    period_start: date


def report_to_dict(report: Report) -> dict:
    return {
        "id": report.id,
        "kind": report.kind,
        "title": report.title,
        "period_start": report.period_start.isoformat(),
        "period_end": report.period_end.isoformat(),
        "status": report.status,
        "error_message": report.error_message,
        "content": report.content,
        "created_at": report.created_at.isoformat(sep=" ") if report.created_at else None,
    }


@router.post("/generate")
async def generate(body: GenerateBody, app: ReportApplication = Depends(get_report_app)):
    if body.kind not in OPEN_KINDS:
        raise HTTPException(status_code=400, detail="该报告种类尚未开放")
    report = await app.generate(body.kind, body.period_start)
    return ok(report_to_dict(report))


@router.get("/current")
async def current(
    kind: str = Query(...),
    period_start: date = Query(...),
    app: ReportApplication = Depends(get_report_app),
):
    report = await app.current(kind, period_start)
    return ok(report_to_dict(report) if report else None)


@router.get("/history")
async def history(kind: str = Query(...), app: ReportApplication = Depends(get_report_app)):
    reports = await app.history(kind)
    return ok([report_to_dict(item) for item in reports])
