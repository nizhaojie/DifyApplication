from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.enterprise.models.daily import EmployeeDailyReport
from app.modules.system.models.user import SysUser


async def upsert_daily(db: AsyncSession, payload: dict) -> EmployeeDailyReport:
    report_date = payload["report_date"]
    employee_id = payload["employee_id"]
    existed = (
        await db.execute(
            select(EmployeeDailyReport).where(
                EmployeeDailyReport.employee_id == employee_id,
                EmployeeDailyReport.report_date == report_date,
            )
        )
    ).scalar_one_or_none()
    if existed is None:
        item = EmployeeDailyReport(**payload)
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item
    for key, value in payload.items():
        setattr(existed, key, value)
    await db.commit()
    await db.refresh(existed)
    return existed


async def list_dailies(
    db: AsyncSession,
    *,
    employee_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    stmt = (
        select(EmployeeDailyReport, SysUser.real_name, SysUser.department)
        .join(SysUser, SysUser.id == EmployeeDailyReport.employee_id, isouter=True)
    )
    count_stmt = select(func.count(EmployeeDailyReport.id))
    if employee_id:
        stmt = stmt.where(EmployeeDailyReport.employee_id == employee_id)
        count_stmt = count_stmt.where(EmployeeDailyReport.employee_id == employee_id)
    if start_date:
        stmt = stmt.where(EmployeeDailyReport.report_date >= start_date)
        count_stmt = count_stmt.where(EmployeeDailyReport.report_date >= start_date)
    if end_date:
        stmt = stmt.where(EmployeeDailyReport.report_date <= end_date)
        count_stmt = count_stmt.where(EmployeeDailyReport.report_date <= end_date)
    total = int((await db.execute(count_stmt)).scalar_one())
    rows = (
        await db.execute(
            stmt.order_by(EmployeeDailyReport.report_date.desc(), EmployeeDailyReport.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    items = []
    from app.utils.serialize import row_to_dict

    for report, real_name, department in rows:
        item = row_to_dict(report)
        item["employee_name"] = real_name
        item["department"] = department
        items.append(item)
    return items, total
