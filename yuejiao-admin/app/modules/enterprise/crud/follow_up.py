from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.enterprise.models.follow_up import CrmFollowUp
from app.modules.enterprise.models.lead import CrmLead


async def add_follow_up(db: AsyncSession, payload: dict) -> CrmFollowUp:
    item = CrmFollowUp(**payload)
    db.add(item)
    lead = await db.get(CrmLead, payload["lead_id"])
    if lead is not None:
        lead.last_contact_time = datetime.now()
    await db.commit()
    await db.refresh(item)
    return item


async def list_follow_ups(db: AsyncSession, lead_id: int) -> list[CrmFollowUp]:
    rows = (
        await db.execute(
            select(CrmFollowUp).where(CrmFollowUp.lead_id == lead_id).order_by(CrmFollowUp.id.desc())
        )
    ).scalars().all()
    return list(rows)
