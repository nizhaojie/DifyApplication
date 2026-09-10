"""客户研判（Profile）模块接口。

POST /profile/assess        研判（三路输入任选其一：text / file / profile）
GET  /profile/profiles      研判记录列表（分页 + 过滤）
GET  /profile/profiles/{id} 研判记录详情（重新跑规则引擎填充 assessments）
"""

import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.response import fail, ok
from app.modules.profile.schemas.assess import AssessResponse, ProfileOut
from app.modules.profile.services.assess_service import AssessService
from app.modules.profile.services.rule_engine import RuleEngine
from app.modules.profile.services.normalize import normalize_from_raw
from app.modules.system.models.user import SysUser

router = APIRouter(prefix="/profile", tags=["客户研判"])


@router.post("/assess", summary="客户研判（文本 / PDF 简历 / Excel / 结构化 profile）")
async def assess(
    text: str | None = Form(None),
    profile: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    svc = AssessService(db)
    if profile:
        try:
            data = json.loads(profile)
        except json.JSONDecodeError:
            return fail("profile 不是合法 JSON", code=400)
        res = await svc.assess_structured(data, operator_id=user.id)
    elif file:
        content = await file.read()
        if not content:
            return fail("上传文件为空", code=400)
        res = await svc.assess_file(content, file.filename or "upload", operator_id=user.id)
    elif text:
        res = await svc.assess_text(text, operator_id=user.id)
    else:
        return fail("需提供 text / file / profile 之一", code=400)
    return ok(AssessResponse(**res).model_dump(mode="json"))


@router.get("/profiles", summary="研判记录列表（分页 + 过滤）")
async def list_profiles(
    limit: int = 50,
    offset: int = 0,
    match_result: str | None = None,
    matched_product: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    from app.modules.profile.models.pf import CustomerProfile

    query = select(CustomerProfile)
    count_query = select(func.count()).select_from(CustomerProfile)
    if match_result:
        query = query.where(CustomerProfile.match_result == match_result)
        count_query = count_query.where(CustomerProfile.match_result == match_result)
    if matched_product:
        query = query.where(CustomerProfile.matched_product == matched_product)
        count_query = count_query.where(CustomerProfile.matched_product == matched_product)
    total = (await db.execute(count_query)).scalar_one()
    rows = (await db.execute(query.order_by(CustomerProfile.id.desc()).limit(limit).offset(offset))).scalars()
    items = [
        ProfileOut(
            id=r.id,
            customer_name=r.customer_name,
            match_result=r.match_result,
            matched_product=r.matched_product,
            match_score=float(r.match_score) if r.match_score is not None else None,
            create_time=str(r.create_time) if r.create_time else None,
        ).model_dump(mode="json")
        for r in rows
    ]
    return ok(items, total=total)


@router.get("/profiles/{profile_id}", summary="研判记录详情")
async def get_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    from app.modules.profile.models.pf import CustomerProfile

    r = await db.get(CustomerProfile, profile_id)
    if not r:
        return fail("未找到该研判记录", code=404)
    assessments = []
    if r.background_info:
        try:
            p = normalize_from_raw(r.background_info)
            engine = await RuleEngine.load(db)
            assessments = [
                {
                    "product_line": a.product_line,
                    "rule_name": a.rule_name,
                    "match_result": a.match_result,
                    "match_score": float(a.match_score),
                    "matched_labels": a.matched_labels,
                    "candidate_programs": a.candidate_programs,
                }
                for a in engine.evaluate(p)
            ]
        except Exception:
            pass
    res = AssessResponse(
        id=r.id,
        source_id=r.source_id,
        customer_name=r.customer_name,
        match_result=r.match_result,
        matched_product=r.matched_product,
        match_score=float(r.match_score) if r.match_score is not None else None,
        match_reason=r.match_reason,
        recommended_programs=r.recommended_programs,
        background_info=r.background_info,
        assessments=assessments,
    )
    return ok(res.model_dump(mode="json"))
