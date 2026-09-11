"""客户研判（Profile）模块接口。

POST /profile/assess        研判（三路输入任选其一：text / file / profile）
GET  /profile/profiles      研判记录列表（分页 + 过滤）
GET  /profile/profiles/{id} 研判记录详情（重新跑规则引擎填充 assessments）

设置页 · 研判规则（产品线）管理：
GET    /profile/rules                规则列表（可按 status / product_line 过滤）
POST   /profile/rules                新增规则
GET    /profile/rules/{rule_id}      规则详情
PUT    /profile/rules/{rule_id}      更新规则（部分更新）
PATCH  /profile/rules/{rule_id}/status 启用 / 禁用
DELETE /profile/rules/{rule_id}      删除规则
"""

import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.response import fail, ok
from app.modules.profile.schemas.assess import AssessResponse, ProfileOut
from app.modules.profile.schemas.rule import RuleIn, RuleOut, RuleStatusIn, RuleUpdate
from app.modules.profile.services.assess_service import AssessService
from app.modules.profile.services.rule_admin import RuleAdminService
from app.modules.profile.services.rule_engine import RuleEngine
from app.modules.profile.services.normalize import normalize_from_raw
from app.modules.system.models.user import SysUser

router = APIRouter(prefix="/profile", tags=["客户研判"])


def _rule_out(rule) -> dict:
    return RuleOut(
        id=rule.id,
        product_line=rule.product_line,
        rule_name=rule.rule_name,
        rule_content=rule.rule_content or {},
        match_prompt=rule.match_prompt,
        priority=rule.priority,
        status=rule.status,
        create_time=str(rule.create_time) if rule.create_time else None,
        update_time=str(rule.update_time) if rule.update_time else None,
    ).model_dump(mode="json")


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


# ---------- 设置页 · 研判规则（产品线）管理 ----------


@router.get("/rules", summary="研判规则列表（设置页）")
async def list_rules(
    status: int | None = None,
    product_line: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    svc = RuleAdminService(db)
    rules = await svc.list_rules(status=status, product_line=product_line)
    items = [_rule_out(r) for r in rules]
    return ok(items, total=len(items))


@router.post("/rules", summary="新增研判规则（产品线）")
async def create_rule(
    data: RuleIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    rule = await RuleAdminService(db).create_rule(data)
    return ok(_rule_out(rule))


@router.get("/rules/{rule_id}", summary="研判规则详情")
async def get_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    rule = await RuleAdminService(db).get_rule(rule_id)
    if not rule:
        return fail("未找到该研判规则", code=404)
    return ok(_rule_out(rule))


@router.put("/rules/{rule_id}", summary="更新研判规则")
async def update_rule(
    rule_id: int,
    data: RuleUpdate,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    rule = await RuleAdminService(db).update_rule(rule_id, data)
    if not rule:
        return fail("未找到该研判规则", code=404)
    return ok(_rule_out(rule))


@router.patch("/rules/{rule_id}/status", summary="启用 / 禁用研判规则")
async def set_rule_status(
    rule_id: int,
    data: RuleStatusIn,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    rule = await RuleAdminService(db).set_status(rule_id, data.status)
    if not rule:
        return fail("未找到该研判规则", code=404)
    return ok(_rule_out(rule))


@router.delete("/rules/{rule_id}", summary="删除研判规则")
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    user: SysUser = Depends(get_current_user),
):
    removed = await RuleAdminService(db).delete_rule(rule_id)
    if not removed:
        return fail("未找到该研判规则", code=404)
    return ok({"id": rule_id, "deleted": True})
