"""研判规则（产品线）管理服务：profile_rule 的 CRUD + 启停。

设置页专用。规则改动即时生效——RuleEngine.load 每次研判都从库里现读，
不需要重启服务或失效缓存。
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.profile.models.pf import ProfileRule
from app.modules.profile.schemas.rule import RuleIn, RuleUpdate


class RuleAdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_rules(
        self, status: int | None = None, product_line: str | None = None
    ) -> list[ProfileRule]:
        query = select(ProfileRule)
        if status is not None:
            query = query.where(ProfileRule.status == status)
        if product_line:
            query = query.where(ProfileRule.product_line == product_line)
        rows = await self.db.execute(
            query.order_by(ProfileRule.product_line, ProfileRule.priority.desc(), ProfileRule.id)
        )
        return list(rows.scalars())

    async def get_rule(self, rule_id: int) -> ProfileRule | None:
        return await self.db.get(ProfileRule, rule_id)

    async def create_rule(self, data: RuleIn) -> ProfileRule:
        rule = ProfileRule(
            product_line=data.product_line.strip(),
            rule_name=data.rule_name.strip(),
            rule_content=data.rule_content.model_dump(),
            match_prompt=data.match_prompt,
            priority=data.priority,
            status=data.status,
        )
        self.db.add(rule)
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def update_rule(self, rule_id: int, data: RuleUpdate) -> ProfileRule | None:
        rule = await self.get_rule(rule_id)
        if not rule:
            return None
        patch = data.model_dump(exclude_unset=True)  # 嵌套 RuleContent 已随之转为 dict
        for key in ("product_line", "rule_name"):
            if patch.get(key):
                patch[key] = patch[key].strip()
        for key, value in patch.items():
            setattr(rule, key, value)
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def set_status(self, rule_id: int, status: int) -> ProfileRule | None:
        rule = await self.get_rule(rule_id)
        if not rule:
            return None
        rule.status = status
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def delete_rule(self, rule_id: int) -> bool:
        rule = await self.get_rule(rule_id)
        if not rule:
            return False
        await self.db.delete(rule)
        await self.db.commit()
        return True
