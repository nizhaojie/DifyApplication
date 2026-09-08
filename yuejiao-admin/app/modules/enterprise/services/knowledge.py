"""本地检索企业助手知识库 Markdown，避开 Dify 分错库和双 LLM 等待。"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

KNOWLEDGE_DIR = (
    Path(__file__).resolve().parents[4] / "dify" / "enterprise" / "knowledge"
)

_PUNCT = re.compile(r"[？?！!。，,、.\s；;：:（）()“”\"'`]+")
_NOISE = ("请问", "一下", "是什么", "是谁", "怎么", "如何", "哪些", "哪个", "在哪", "多少")
_FAQ_SPLIT = re.compile(r"^##\s*\d+\.\s*", re.M)
_HEADING = re.compile(r"^#{1,3}\s+(.+)$", re.M)
_EMPTY_KB = re.compile(
    r"(知识库里没有|问答对里没有|当前企业信息/新人指南知识库里没有|没有关于.{0,20}的内容)"
)

_PHONE = re.compile(r"1[3-9]\d{9}")
_BUSINESS = (
    "想咨询",
    "录入",
    "新客户",
    "已签约",
    "已流失",
    "请假",
    "投诉",
    "工单",
    "日报",
    "待办",
    "查一下",
    "跟进记录",
    "工作概览",
)
_KB_HINTS = (
    "简称",
    "划转",
    "主营",
    "学费",
    "报名",
    "打印机",
    "健身房",
    "会议室",
    "茶水间",
    "工牌",
    "入职",
    "IT",
    "内线",
    "事业部",
    "双元制",
    "德语",
    "B1",
    "新加坡",
    "公司地址",
    "联系方式",
    "价值观",
    "使命",
    "简介",
    "介绍",
)


def is_empty_kb_reply(text: str) -> bool:
    return bool(_EMPTY_KB.search(text or ""))


def looks_like_knowledge(query: str) -> bool:
    text = query or ""
    if _PHONE.search(text) or any(token in text for token in _BUSINESS):
        return False
    if any(token in text for token in _KB_HINTS):
        return True
    return bool(re.search(r"(是什么|在几楼|找谁|有哪些|叫什么)", text))


def answer(query: str, *, loose: bool = False) -> dict | None:
    text = (query or "").strip()
    if not text:
        return None
    if not loose and not looks_like_knowledge(text):
        return None

    if any(token in text for token in ("公司简介", "企业简介", "公司介绍")):
        intro = company_intro()
        if intro is not None:
            return intro

    faq_hit = _best_faq(text)
    if faq_hit is not None:
        return faq_hit

    docs_hit = _best_section(text)
    if docs_hit is not None:
        return docs_hit

    if "简称" in text:
        return {
            "reply": "公司简称是「粤教服务」。",
            "intent": "faq",
            "title": "公司简称",
            "citation": "知识库 · 常见问答对 · 公司简称",
        }
    return None


def _gist(text: str) -> str:
    compact = _PUNCT.sub("", text or "")
    for noise in _NOISE:
        compact = compact.replace(noise, "")
    return compact.lower()


def _tokens(text: str) -> set[str]:
    gist = _gist(text)
    parts: set[str] = set(re.findall(r"[a-z0-9+]{2,}", gist))
    chars = re.findall(r"[\u4e00-\u9fa5]", gist)
    skip = {"什么", "怎么", "如何", "我们", "可以", "告诉", "知道", "了解", "请问", "一下"}
    for size in (2, 3, 4):
        for index in range(0, len(chars) - size + 1):
            gram = "".join(chars[index : index + size])
            if gram not in skip:
                parts.add(gram)
    return parts


@lru_cache(maxsize=1)
def _faq_items() -> tuple[tuple[str, str], ...]:
    path = KNOWLEDGE_DIR / "03-常见问答对.md"
    raw = path.read_text(encoding="utf-8")
    chunks = _FAQ_SPLIT.split(raw)
    items: list[tuple[str, str]] = []
    for chunk in chunks[1:]:
        lines = [line.rstrip() for line in chunk.strip().splitlines() if line.strip()]
        if not lines:
            continue
        question = lines[0].strip()
        body = "\n".join(lines[1:]).replace("答：", "").strip()
        if question and body:
            items.append((question, body))
    return tuple(items)


@lru_cache(maxsize=1)
def _doc_sections() -> tuple[tuple[str, str, str], ...]:
    sections: list[tuple[str, str, str]] = []
    for name in ("01-企业信息.md", "02-公司新人指南.md"):
        path = KNOWLEDGE_DIR / name
        raw = path.read_text(encoding="utf-8")
        matches = list(_HEADING.finditer(raw))
        if not matches:
            sections.append((name, path.stem, raw[:800]))
            continue
        for index, hit in enumerate(matches):
            start = hit.end()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(raw)
            body = raw[start:end].strip()
            if body:
                sections.append((name, hit.group(1).strip(), body))
    return tuple(sections)


def _best_faq(query: str) -> dict | None:
    q_gist = _gist(query)
    q_tokens = _tokens(query)
    ranked: list[tuple[int, str, str]] = []
    for question, body in _faq_items():
        score = 0
        qg = _gist(question)
        if q_gist and (q_gist in qg or qg in q_gist):
            score += 12
        overlap = q_tokens & _tokens(question + body)
        score += len(overlap) * 3
        if "简称" in query and "简称" in question:
            score += 20
        if score:
            ranked.append((score, question, body))
    if not ranked:
        return None
    ranked.sort(key=lambda item: item[0], reverse=True)
    score, question, body = ranked[0]
    if score < 8:
        return None
    if "简称" in query:
        reply = "公司简称是「粤教服务」。"
    else:
        reply = body.split("\n", 1)[0].strip()
    return {
        "reply": reply,
        "intent": "faq",
        "title": question,
        "citation": f"知识库 · 常见问答对 · {question}",
    }


_FACILITIES = ("打印机", "健身房", "会议室", "茶水间", "工牌", "行政办公室")


def _best_section(query: str) -> dict | None:
    facility = _facility_window(query)
    if facility is not None:
        return facility
    q_tokens = _tokens(query)
    if not q_tokens:
        return None
    ranked: list[tuple[int, str, str, str]] = []
    for source, title, body in _doc_sections():
        hay = title + "\n" + body
        score = sum(2 for token in q_tokens if token in hay)
        score += len(q_tokens & _tokens(title)) * 6
        if any(token in query for token in ("几楼", "在哪", "位置")) and any(
            token in hay for token in ("楼", "位置")
        ):
            score += 8
        if score:
            ranked.append((score, source, title, body))
    if not ranked:
        return None
    ranked.sort(key=lambda item: item[0], reverse=True)
    score, source, title, body = ranked[0]
    if score < 6:
        return None
    excerpt = _excerpt(body, query)
    kind = "guide" if "新人指南" in source else "docs"
    book = "新人指南" if kind == "guide" else "企业信息"
    return {
        "reply": f"**{title}**\n\n{excerpt}",
        "intent": kind,
        "title": title,
        "citation": f"知识库 · {book} · {title}",
    }


def _facility_window(query: str) -> dict | None:
    key = next((item for item in _FACILITIES if item in query), None)
    if key is None:
        return None
    ranked: list[tuple[int, str, str, str]] = []
    for source, title, body in _doc_sections():
        lines = body.splitlines()
        for index, line in enumerate(lines):
            if key not in line:
                continue
            window = "\n".join(lines[max(0, index - 1) : index + 6]).strip()
            score = 12
            if any(token in query for token in ("几楼", "在哪", "位置")) and "楼" in window:
                score += 20
            if "找谁" in query and any(token in window for token in ("8010", "IT", "内线")):
                score += 8
            if line.strip() == key:
                score += 10
            ranked.append((score, source, title, window))
    if not ranked:
        return None
    ranked.sort(key=lambda item: (-item[0], len(item[3])))
    _score, source, title, window = ranked[0]
    if any(token in query for token in ("找谁", "坏了", "故障")) and "8010" not in window:
        window += "\n坏了找 IT：内线 8010，或企业微信「IT服务台」。"
    kind = "guide" if "新人指南" in source else "docs"
    book = "新人指南" if kind == "guide" else "企业信息"
    return {
        "reply": f"**{title}**\n\n{window}",
        "intent": kind,
        "title": title,
        "citation": f"知识库 · {book} · {title}",
    }


def company_intro() -> dict | None:
    for source, title, body in _doc_sections():
        if "01-" not in source or title != "企业简介":
            continue
        paras = [line.strip() for line in body.splitlines() if line.strip() and not line.startswith(">")]
        text = "\n".join(paras[:3])
        return {
            "reply": f"广东省教育服务有限公司，简称「粤教服务」。\n\n{text}",
            "intent": "docs",
            "title": title,
            "citation": f"知识库 · 企业信息 · {title}",
        }
    return None


def company_card() -> dict:
    intro = company_intro()
    return {
        "short_name": "粤教服务",
        "full_name": "广东省教育服务有限公司",
        "transfer": "2024年3月划转至广东教育国际交流服务中心有限公司（简称「粤教国际」）",
        "intro": (intro or {}).get("reply")
        or "广东省教育服务有限公司（简称「粤教服务」），创办于1981年。",
        "mission": "致力让生活更美好",
        "values": "向上向善，实干笃行",
        "address": "广东省广州市越秀区东风东路 723 号高教大厦二楼",
        "phone": "020-37628058",
        "email": "postmaster@ges1981.com",
        "site": "http://www.gdjyfw.cn",
        "wechat": "gdjfgs333",
        "business": ["国际教育", "智慧教育", "素质教育", "实体教育"],
        "departments": [
            "双元制事业部",
            "智能装备事业部",
            "课后服务事业部",
            "研学服务事业部",
            "科技赛事事业部",
        ],
    }


def guide_catalog() -> list[dict]:
    items: list[dict] = []
    for source, title, body in _doc_sections():
        if "02-" not in source:
            continue
        if not title.startswith(("一、", "二、", "三、", "四、", "五、", "六、", "七、", "八、", "九、", "十、")):
            continue
        items.append({"title": title, "excerpt": _excerpt(body, title, 180), "content": body})
    return items


def _excerpt(body: str, query: str, limit: int = 220) -> str:
    compact = re.sub(r"\n{2,}", "\n", body).strip()
    tokens = [token for token in _tokens(query) if token in compact]
    if tokens:
        idx = compact.find(tokens[0])
        start = max(0, idx - 40)
        chunk = compact[start : start + limit]
        if start:
            chunk = "…" + chunk
        if start + limit < len(compact):
            chunk += "…"
        return chunk
    return compact[:limit]
