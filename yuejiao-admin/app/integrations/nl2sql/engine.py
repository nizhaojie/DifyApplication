from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.nl2sql.guard import SqlGuardError, assert_readonly_sql
from app.modules.enterprise.services.lead.extract import extract_person_name
import re


def _safe_name(name: str) -> str:
    return re.sub(r"[^\u4e00-\u9fa5A-Za-z0-9]", "", name)[:12]


def build_sql(query: str) -> str:
    text_in = query.strip()
    name = extract_person_name(text_in) or ""
    like_name = _safe_name(name)

    if any(token in text_in for token in ("跟进记录", "跟进", "最近联系")):
        if like_name:
            return (
                "SELECT f.id, l.customer_name, f.follow_type, f.content, f.next_plan, f.create_time "
                "FROM crm_follow_up f JOIN crm_lead l ON l.id = f.lead_id "
                f"WHERE l.customer_name LIKE '%{like_name}%' ORDER BY f.id DESC LIMIT 20"
            )
        return (
            "SELECT f.id, l.customer_name, f.follow_type, f.content, f.create_time "
            "FROM crm_follow_up f JOIN crm_lead l ON l.id = f.lead_id "
            "ORDER BY f.id DESC LIMIT 20"
        )
    if any(token in text_in for token in ("请假", "待审批")):
        return (
            "SELECT s.id, u.real_name AS student_name, s.leave_type, s.reason, s.status, s.start_time, s.end_time "
            "FROM student_admin_service s "
            "JOIN student_info i ON i.id = s.student_id "
            "JOIN sys_user u ON u.id = i.user_id "
            "WHERE s.service_type = 'leave' "
            + ("AND s.status = 'pending' " if "待" in text_in or "审批" in text_in else "")
            + "ORDER BY s.id DESC LIMIT 20"
        )
    if any(token in text_in for token in ("日报",)):
        today = date.today().isoformat()
        return (
            "SELECT r.id, u.real_name AS employee_name, r.report_date, r.content, r.next_plan, r.status "
            f"FROM employee_daily_report r JOIN sys_user u ON u.id = r.employee_id "
            f"WHERE r.report_date = '{today}' ORDER BY r.id DESC LIMIT 20"
        )
    if any(token in text_in for token in ("组织", "部门", "架构")):
        return "SELECT id, org_name, parent_id, org_level, manager_id FROM sys_organization WHERE status = 1 ORDER BY sort_order, id LIMIT 50"
    if any(token in text_in for token in ("漏斗", "签约", "流失", "意向客户统计")):
        return "SELECT status, COUNT(*) AS total FROM crm_lead GROUP BY status LIMIT 20"
    if any(token in text_in for token in ("投诉", "工单")):
        return (
            "SELECT t.id, u.real_name AS student_name, t.category, t.title, t.status, t.priority "
            "FROM student_feedback_ticket t "
            "JOIN student_info i ON i.id = t.student_id "
            "JOIN sys_user u ON u.id = i.user_id "
            "ORDER BY t.id DESC LIMIT 20"
        )
    if like_name or any(token in text_in for token in ("客户", "意向")):
        where = f"WHERE customer_name LIKE '%{like_name}%' " if like_name else ""
        return (
            "SELECT id, customer_name, contact_info, intended_country, intended_major, status, last_contact_time "
            f"FROM crm_lead {where}ORDER BY id DESC LIMIT 20"
        )
    raise SqlGuardError("没有听懂要查哪张表，请说客户、跟进、请假、日报或组织")


async def run_nl2sql(db: AsyncSession, query: str) -> dict:
    sql = assert_readonly_sql(build_sql(query))
    result = await db.execute(text(sql))
    columns = list(result.keys())
    rows = [dict(zip(columns, row)) for row in result.fetchall()]
    for item in rows:
        for key, value in list(item.items()):
            if hasattr(value, "isoformat"):
                item[key] = value.isoformat(sep=" ") if hasattr(value, "hour") else value.isoformat()
    return {"sql": sql, "columns": columns, "rows": rows, "total": len(rows)}
