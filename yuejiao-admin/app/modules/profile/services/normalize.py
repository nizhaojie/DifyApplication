"""原始客户信息 → 规范化 CustomerProfile。

两路输入都走这里：
- 示例客户(用户信息数据示例)的 JSON → 规范化（黄金集直接喂 rule_engine）
- extract 工作流的 JSON 输出 → 规范化（生产链路）
"""

import re

from app.modules.profile.schemas.profile import CustomerProfile, LanguageItem

# ---------- 学历 ----------
EDU_RULES = [
    (["博士"], "博士"),
    (["硕士"], "硕士"),
    (["本科"], "本科"),
    (["大专", "专科"], "大专"),
    (["职高", "中专", "中职", "技校", "中技", "中职技校"], "中职中技"),
    (["高二", "高中"], "高中"),
    (["初中", "初三"], "初中"),
]


def norm_education(text: str | None) -> str | None:
    if not text:
        return None
    for keys, canon in EDU_RULES:
        if any(k in text for k in keys):
            return canon
    return None


# ---------- 收入 ----------
def norm_income(text: str | None) -> tuple[str | None, int | None]:
    """annual_income_range like '30-50万' / '200万以上' / '10-15万（待业）' → (level, rank)."""
    if not text:
        return None, None
    nums = re.findall(r"(\d+)", text)
    if not nums:
        return None, None
    high = max(int(n) for n in nums)  # 取范围高值
    if "万以上" in text and high <= 10:
        high = 1000  # "10万以上" 这种兜底
    if high < 20:
        return "低", 1
    if high < 50:
        return "中", 2
    if high < 100:
        return "高", 3
    return "很高", 4


# ---------- 语言 ----------
def parse_language(text: str | None) -> list[LanguageItem]:
    if not text:
        return []
    # 「没学过德语」这类否定表述不是语言能力；不剥掉会让 derive_country 末尾的
    # 「有德语就判德国」误触发（Dify 的 LLM 常把否定也写进 language_ability）。
    t = strip_negated_languages(text)
    items: list[LanguageItem] = []
    # 德语
    if "德语" in t or re.search(r"\bB1\b|\bA2\b|\bB2\b|\bC1\b", t) and "德" in t:
        m = re.search(r"(B1|B2|C1|C2|A1|A2)", t)
        items.append(LanguageItem(lang="德语", level=m.group(1) if m else None))
    # 英语
    if "英语" in t or "雅思" in t or "托福" in t or "四级" in t or "六级" in t:
        m = re.search(r"(雅思\s?[\d.]+|托福\s?\d+|四级|六级|母语级|流利|良好|中等|优秀|基础)", t)
        items.append(LanguageItem(lang="英语", level=m.group(1) if m else None))
    if not items and ("零基础" in t or "无" in t):
        return []
    return items


# ---------- 需求 ----------
NEED_KEYWORDS = [
    ("移民", "移民"),
    ("子女教育", "子女教育"),
    ("落户", "落户"),
    ("学历提升", "学历提升"),
    ("镀金", "学历提升"),
    ("转换赛道", "转换赛道"),
    ("转专业", "转换赛道"),
    ("就业", "就业"),
    ("升学", "升学"),
    ("素质教育", "升学"),
]


def extract_needs(core_demand: str | None, tags: dict) -> list[str]:
    needs: list[str] = []
    text = core_demand or ""
    for kw, label in NEED_KEYWORDS:
        if kw in text and label not in needs:
            needs.append(label)
    # tag 权重高的也补
    for tag in tags:
        for kw, label in NEED_KEYWORDS:
            if kw in tag and label not in needs:
                needs.append(label)
    return needs


# ---------- 国家意向 ----------
# 「没学过德语」这类否定表述不能触发德国意向推断
_NEG_LANG_RE = re.compile(r"(?:没有?学过|不会|不懂|零基础|未通过|无)\s*(德语|英语|日语|韩语|小语种)")


def strip_negated_languages(text: str | None) -> str:
    """去掉被否定的语言表述，供国家意向 / 语言抽取共用。"""
    return _NEG_LANG_RE.sub(" ", text or "")


def derive_country(
    summary: str | None,
    core_demand: str | None,
    language: list[LanguageItem],
    intended: str | None,
) -> str | None:
    if intended:
        return intended
    blob = strip_negated_languages(" ".join(filter(None, [summary, core_demand])))
    if "新加坡" in blob:
        return "新加坡"
    if "德国" in blob or "赴德" in blob or "德语" in blob or "永居" in blob and "德" in blob:
        return "德国"
    langs = {l.lang for l in language}
    if "德语" in langs:
        return "德国"
    return None


# ---------- 背景关键词（用于中德细分专业映射） ----------
BG_KEYWORDS = [
    "机电", "机械", "数控", "自动化", "电气", "电子",
    "汽车", "汽修",
    "建筑", "土木", "工程管理",
    "计算机", "信息", "软件", "IT",
    "护理", "医疗", "护士",
    "酒店", "航空", "餐饮", "服务",
    "商贸", "会计",
    "车企", "管理",
]


def extract_background_keywords(education_raw: str | None, summary: str | None, tags: dict) -> list[str]:
    blob = " ".join(filter(None, [education_raw or "", summary or ""]))
    blob += " " + " ".join(tags.keys())
    found = [k for k in BG_KEYWORDS if k in blob]
    # 去重保序
    seen = set()
    out = []
    for k in found:
        if k not in seen:
            seen.add(k)
            out.append(k)
    return out


# ---------- 能力/态度推断（来自 tags） ----------
def _tag_has(tags: dict, *keys: str) -> bool | None:
    for tag, w in tags.items():
        for k in keys:
            if k in tag and isinstance(w, (int, float)) and w >= 0.6:
                return True
    return None


def infer_hands_on(tags: dict, summary: str | None) -> bool | None:
    return _tag_has(tags, "动手") or (("动手能力" in (summary or "")) or None)


def infer_logic(tags: dict) -> bool | None:
    return _tag_has(tags, "逻辑", "思维")


def infer_learning_attitude(tags: dict) -> bool | None:
    return _tag_has(tags, "学习毅力", "学习意愿", "学习态度", "学习力")


def infer_de_qualified(language: list[LanguageItem], tags: dict) -> bool | None:
    # 德语 B1+
    de_level = None
    for l in language:
        if l.lang == "德语" and l.level in {"B1", "B2", "C1", "C2"}:
            return True
    # 或有德语学习潜力/意愿
    for tag, w in tags.items():
        if ("德语" in tag or "德语潜力" in tag) and isinstance(w, (int, float)) and w >= 0.6:
            return True
        if "语言学习力" in tag and isinstance(w, (int, float)) and w >= 0.7:
            return True
    return de_level


# ---------- 顶层：从原始 dict 规范化 ----------
def normalize_from_raw(raw: dict) -> CustomerProfile:
    """从 extract 工作流输出或示例客户 JSON 规范化为 CustomerProfile。

    防御：Dify 工作流偶发把 LLM 的 JSON 整段透传成字符串（end 节点类型设成 string，
    或中间多套了一层）。dify_client 已尽力解析；到这里还不是 dict 说明解析失败，
    这里不能 500 —— 保留原文进 summary，让规则引擎按空 profile 出保守判定。
    """
    if not isinstance(raw, dict):
        if isinstance(raw, str) and raw.strip():
            return CustomerProfile(summary=raw.strip()[:2000])
        raw = {}
    tags = raw.get("tags") or raw.get("tag_weight") or {}
    edu_raw = raw.get("education") or raw.get("education_raw")
    edu = raw.get("education_level") or norm_education(edu_raw)
    income_raw = raw.get("annual_income_range") or raw.get("income_raw")
    inc_level, inc_rank = norm_income(income_raw)
    if raw.get("income_level") and raw.get("income_rank"):
        inc_level = raw["income_level"]
        inc_rank = raw["income_rank"]
    language = parse_language(raw.get("language_ability") or raw.get("language_text")) or [
        LanguageItem(**l) for l in (raw.get("language") or [])
    ]
    needs = raw.get("needs") or extract_needs(raw.get("core_demand"), tags)
    country = derive_country(
        raw.get("profile_summary") or raw.get("summary"),
        raw.get("core_demand"),
        language,
        raw.get("intended_country"),
    )
    bg = extract_background_keywords(edu_raw, raw.get("profile_summary") or raw.get("summary"), tags)
    return CustomerProfile(
        name=raw.get("name"),
        age=raw.get("age"),
        gender=raw.get("gender"),
        education_level=edu,
        education_raw=edu_raw,
        location=raw.get("location"),
        income_level=inc_level,
        income_rank=inc_rank,
        income_raw=income_raw,
        language=language,
        de_qualified=infer_de_qualified(language, tags),
        core_demand=raw.get("core_demand"),
        needs=needs,
        intended_country=country,
        hands_on=infer_hands_on(tags, raw.get("profile_summary") or raw.get("summary")),
        logic_strong=infer_logic(tags),
        learning_attitude=infer_learning_attitude(tags),
        background_keywords=bg,
        summary=raw.get("profile_summary") or raw.get("summary"),
        tags=tags,
    )
