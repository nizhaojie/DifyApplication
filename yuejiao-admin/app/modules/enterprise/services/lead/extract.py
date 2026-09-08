import re

LEAD_STATUSES = ("new", "contacting", "qualified", "signed", "lost")
STATUS_FROM_TEXT = {
    "新线索": "new",
    "新建": "new",
    "跟进中": "contacting",
    "联系中": "contacting",
    "已合格": "qualified",
    "合格": "qualified",
    "已签约": "signed",
    "签约": "signed",
    "已流失": "lost",
    "流失": "lost",
}
STATUS_TO_TEXT = {
    "new": "新线索",
    "contacting": "跟进中",
    "qualified": "已合格",
    "signed": "已签约",
    "lost": "已流失",
}

PHONE_RE = re.compile(r"1[3-9]\d{9}|1\d{2,3}x{2,}", re.I)
COUNTRY_RE = re.compile(r"(美国|英国|加拿大|澳大利亚|澳洲|新加坡|德国|日本|韩国|法国)")
LEVEL_RE = re.compile(r"(初中|高中|专科|本科|硕士|博士|2\s*\+\s*2)")
NAME_RE = re.compile(r"^([\u4e00-\u9fa5]{2,4})")
PERSON_RE = re.compile(
    r"(?:查一下|查询一下|查询|同意|批准|通过|拒绝|驳回|把|将)\s*([\u4e00-\u9fa5]{2,4})"
)
LEAVE_PERSON_RE = re.compile(r"(?:同意|批准|通过|拒绝|驳回)\s*([\u4e00-\u9fa5]{2,4}?)的请假")
STATUS_PERSON_RE = re.compile(r"(?:把|将)\s*([\u4e00-\u9fa5]{2,4}?)(?:改成|更新为|标记为|标成)")
FOLLOW_TYPES = ("phone", "wechat", "meeting", "email", "other")


def extract_person_name(text: str) -> str | None:
    leave = LEAVE_PERSON_RE.search(text)
    if leave:
        return leave.group(1)
    status_hit = STATUS_PERSON_RE.search(text)
    if status_hit:
        return status_hit.group(1)
    hit = PERSON_RE.search(text)
    if hit:
        name = hit.group(1)
        for noise in ("最近", "今日", "今天", "客户", "意向", "改成"):
            name = name.replace(noise, "")
        return name or None
    return None


def guess_person_name(text: str) -> str | None:
    named = extract_person_name(text)
    if named:
        return named
    raw = (text or "").strip()
    if not (PHONE_RE.search(raw) or "想咨询" in raw or "客户" in raw):
        return None
    lead = NAME_RE.match(raw)
    if not lead:
        return None
    token = lead.group(1)
    skip = {"公司", "简称", "打印", "待办", "今天", "你好", "请问"}
    if token in skip:
        return None
    return token


def extract_status(text: str) -> str | None:
    for label, code in STATUS_FROM_TEXT.items():
        if label in text:
            return code
    return None


def extract_lead_from_text(text: str, owner_employee_id: int) -> dict:
    raw = text.strip()
    phone = None
    phone_hit = PHONE_RE.search(raw)
    if phone_hit:
        phone = phone_hit.group(0)
    country_hit = COUNTRY_RE.search(raw)
    level_hit = LEVEL_RE.search(raw)
    name = None
    name_hit = NAME_RE.match(raw)
    if name_hit:
        name = name_hit.group(1)
    if not name:
        name = extract_person_name(raw)
    if not name:
        tokens = re.findall(r"[\u4e00-\u9fa5]{2,4}", raw)
        skip = {"想咨询", "咨询", "意向", "客户", "美国", "英国", "加拿大", "新加坡", "德国", "硕士", "本科", "博士"}
        name = next((item for item in tokens if item not in skip), None)
    if not name:
        raise ValueError("没有听清客户姓名，请说「张三 138xxxx 想咨询美国硕士」这种")
    major = None
    if level_hit and "咨询" in raw:
        major = level_hit.group(1).replace(" ", "")
    return {
        "customer_name": name,
        "contact_info": phone,
        "education_level": None if level_hit is None else level_hit.group(1).replace(" ", ""),
        "intended_country": None if country_hit is None else country_hit.group(1),
        "intended_major": major,
        "background_info": raw,
        "source_channel": "口述录入",
        "status": "new",
        "owner_employee_id": owner_employee_id,
        "remark": raw,
    }


def extract_daily_from_text(text: str) -> dict:
    raw = text.strip()
    progress, risks, plan = [], [], ""

    def _chunk(after: str, until: tuple[str, ...]) -> str:
        idx = raw.find(after)
        if idx < 0:
            return ""
        start = idx + len(after)
        end = len(raw)
        for token in until:
            pos = raw.find(token, start)
            if pos >= 0:
                end = min(end, pos)
        return raw[start:end].strip(" ：:，,。")

    progress_text = _chunk("进展", ("问题", "风险", "计划", "明天")) or _chunk("今天", ("问题", "风险", "计划", "明天"))
    risk_text = _chunk("问题", ("计划", "明天")) or _chunk("风险", ("计划", "明天"))
    plan_text = _chunk("计划", ()) or _chunk("明天", ())
    if progress_text:
        progress = [progress_text]
    if risk_text:
        risks = [risk_text]
    if plan_text:
        plan = plan_text
    if not progress:
        progress = [raw]
    content_parts = []
    if progress:
        content_parts.append("进展：" + "；".join(progress))
    if risks:
        content_parts.append("问题：" + "；".join(risks))
    if plan:
        content_parts.append("计划：" + plan)
    return {
        "raw_content": raw,
        "content": "\n".join(content_parts),
        "key_progress": progress,
        "risks": risks,
        "next_plan": plan or None,
        "status": "submitted",
    }


def extract_keyword(text: str) -> str | None:
    name = extract_person_name(text)
    if name:
        return name
    tokens = re.findall(r"[\u4e00-\u9fa5]{2,4}", text)
    skip = {"查一下", "查询", "客户", "意向", "最近", "跟进", "记录", "列表", "今天", "待办"}
    for token in tokens:
        if token not in skip:
            return token
    return None
