from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.enterprise.models.lead import CrmLead
from app.modules.system.models.user import SysUser


async def create_lead(db: AsyncSession, payload: dict) -> CrmLead:
    lead = CrmLead(**payload)
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


async def get_lead(db: AsyncSession, lead_id: int) -> CrmLead | None:
    return await db.get(CrmLead, lead_id)


async def list_leads(
    db: AsyncSession,
    *,
    keyword: str | None = None,
    status: str | None = None,
    owner_employee_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[CrmLead], int]:
    stmt = select(CrmLead)
    count_stmt = select(func.count(CrmLead.id))
    if keyword:
        like = f"%{keyword}%"
        cond = or_(
            CrmLead.customer_name.like(like),
            CrmLead.contact_info.like(like),
            CrmLead.intended_country.like(like),
            CrmLead.intended_major.like(like),
            CrmLead.remark.like(like),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if status:
        stmt = stmt.where(CrmLead.status == status)
        count_stmt = count_stmt.where(CrmLead.status == status)
    if owner_employee_id:
        stmt = stmt.where(CrmLead.owner_employee_id == owner_employee_id)
        count_stmt = count_stmt.where(CrmLead.owner_employee_id == owner_employee_id)
    total = int((await db.execute(count_stmt)).scalar_one())
    rows = (
        await db.execute(
            stmt.order_by(CrmLead.id.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()
    return list(rows), total


async def funnel_counts(db: AsyncSession) -> dict[str, int]:
    rows = (await db.execute(select(CrmLead.status, func.count(CrmLead.id)).group_by(CrmLead.status))).all()
    data = {"new": 0, "contacting": 0, "qualified": 0, "signed": 0, "lost": 0}
    for status, count in rows:
        data[str(status)] = int(count)
    return data


async def find_leads_by_name(db: AsyncSession, name: str) -> list[CrmLead]:
    like = f"%{name}%"
    rows = (await db.execute(select(CrmLead).where(CrmLead.customer_name.like(like)).order_by(CrmLead.id.desc()))).scalars().all()
    return list(rows)


async def owner_name_map(db: AsyncSession, owner_ids: list[int]) -> dict[int, str]:
    if not owner_ids:
        return {}
    rows = (await db.execute(select(SysUser.id, SysUser.real_name).where(SysUser.id.in_(owner_ids)))).all()
    return {int(i): name for i, name in rows}
