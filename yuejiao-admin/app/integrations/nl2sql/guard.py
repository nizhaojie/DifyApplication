import re

ALLOWED_TABLES = {
    "crm_lead",
    "crm_follow_up",
    "employee_daily_report",
    "sys_organization",
    "student_info",
    "student_admin_service",
    "student_score",
    "student_feedback_ticket",
    "todo_item",
    "onboarding_guide",
    "sys_user",
}

FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke|into\s+outfile|load_file|sleep|benchmark)\b",
    re.I,
)
TABLE_RE = re.compile(r"\b(from|join)\s+([`\"]?)([a-zA-Z_][\w]*)\2", re.I)


class SqlGuardError(ValueError):
    pass


def assert_readonly_sql(sql: str) -> str:
    cleaned = sql.strip().rstrip(";")
    if not cleaned:
        raise SqlGuardError("SQL 为空")
    if ";" in cleaned:
        raise SqlGuardError("只允许一条 SQL")
    if FORBIDDEN.search(cleaned):
        raise SqlGuardError("NL2SQL 只允许 SELECT，禁止写库或危险函数")
    if not re.match(r"^\s*select\b", cleaned, re.I):
        raise SqlGuardError("NL2SQL 只允许 SELECT")
    tables = {item.group(3).lower() for item in TABLE_RE.finditer(cleaned)}
    unknown = tables - ALLOWED_TABLES
    if unknown:
        raise SqlGuardError(f"表不在白名单：{', '.join(sorted(unknown))}")
    if "limit" not in cleaned.lower():
        cleaned += " LIMIT 50"
    return cleaned
