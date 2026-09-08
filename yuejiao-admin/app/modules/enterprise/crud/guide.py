from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.enterprise.models.guide import OnboardingGuide


async def list_guides(db: AsyncSession, keyword: str | None = None) -> list[OnboardingGuide]:
    stmt = select(OnboardingGuide).where(OnboardingGuide.status == 1)
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(or_(OnboardingGuide.title.like(like), OnboardingGuide.content.like(like), OnboardingGuide.category.like(like)))
    rows = (await db.execute(stmt.order_by(OnboardingGuide.sort_order.asc(), OnboardingGuide.id.asc()))).scalars().all()
    return list(rows)
