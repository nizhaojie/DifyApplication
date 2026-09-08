"""本地启发式提取：原始客户文本 → 与《用户信息数据示例》同构的字段。

`settings.pf_llm_fallback=heuristic`（Dify 不可达 / 未配 Key）时由
`dify_client.extract()` 调用。没有它，无 LLM 时 extract 只能返回原文摘要，
规则引擎拿到的是一份几乎全空的 profile（age/education/income/language 全 None），
文本与 PDF 输入实际上判不准——只靠 background_keywords 兜一点。

原则：**只认字面明确的写法，不猜**。没写就留空，让规则引擎按字段缺失自然低分，
宁可漏判也不编造（编造字段会让结果看着可信其实全错）。
产出 dict 后仍走 `normalize_from_raw`，归一化逻辑不在此重复。
"""

import re

from app.modules.profile.services.normalize import strip_negated_languages

# 年龄：「26 岁」/「年龄26」，限合理区间
_AGE_PAT = re.compile(r"(\d{1,3})\s*岁|年龄[：:为是]?\s*(\d{2,3})")
# 性别
_GENDER_PAT = re.compile(r"性别[：:为是 ]*(男|女)|男性|女性")
# 学历：优先「X 毕业 / 学历为 X」这类确定语境
_EDU_WORDS = (
    "博士|硕士|研究生|本科|大专|专科|职高|中专|中职|技校|中技|高二|高中|初三|初中"
)
_EDU_PAT = re.compile(rf"({_EDU_WORDS})(?:毕业|学历|结业|肄业)")
_EDU_PAT2 = re.compile(rf"(?:学历|文凭|毕业|应届)[：:为是 ]*({_EDU_WORDS})")
# 志愿表述（想读本科 / 申请硕士…）不算本人学历
_EDU_VOLUNTEER = re.compile(
    rf"(?:想|希望|计划|打算|准备|在读|报考|申请|升)[^，。；,;]{{0,4}}?({_EDU_WORDS})"
)

# 收入：按确定性从高到低匹配，返回规整后的字符串喂给 norm_income
_INCOME_PATS = [
    (re.compile(r"(\d+(?:\.\d+)?)\s*[-~—]\s*(\d+(?:\.\d+)?)\s*万"), "range"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*万\s*(?:以上|到|出头)"), "above"),
    (re.compile(r"收入[：:为是约]?\s*(\d+(?:\.\d+)?)\s*万"), "exact"),
    (re.compile(r"(?:年|全年|家庭|税前|税后)[^，。；,;]{0,6}?(\d+(?:\.\d+)?)\s*万"), "annual"),
    (re.compile(r"(?:月入|月薪|月收入)[^，。；,;]{0,4}?(\d{3,})\s*元?"), "monthly"),
]

# 语言：「没学过德语」这类否定表述不能算语言能力/德国意向，否则会把
# 「想去新加坡、只是坦白没学过德语」的客户误判成意向德国。先剥掉否定。
# 剥离逻辑在 normalize.strip_negated_languages 里，derive_country 也用同一份。
# parse_language 的英语水平备选里有「中等/良好」这类通用词，喂全文会把
# 「收入中等」误读成英语水平 → 只保留提到语言的分句。
_LANG_MARK = re.compile(r"英语|德语|日语|韩语|小语种|雅思|托福|四级|六级")
_SEG_SPLIT = re.compile(r"[，。；,.；;\n]")

# 无数字时的定性收入（「家里收入中等」）：直接产出 income_level/rank 供 normalize 采用
_QUAL_INCOME = re.compile(
    r"(?:家庭|家境|家里|收入|经济)[^，。；,;\n]{0,6}?"
    r"(很高|极高|富裕|较高|中等|很好|一般|普通|高|中|低)"
)
_QUAL_MAP = {
    "低": ("低", 1),
    "中": ("中", 2), "中等": ("中", 2), "较高": ("中", 2), "一般": ("中", 2), "普通": ("中", 2),
    "高": ("高", 3), "很好": ("高", 3),
    "很高": ("很高", 4), "极高": ("很高", 4), "富裕": ("很高", 4),
}

# 能力标签：命中文本即写入 tags，权重需 ≥0.6 才会被 infer_* 采信
_TAG_RULES = [
    (["动手能力强", "动手强", "实操强", "动手不错", "能动手", "喜欢动手"], "动手能力强", 0.8),
    (["逻辑强", "逻辑思维", "逻辑清晰", "思路清晰", "理性"], "逻辑思维强", 0.8),
    (
        ["学习意愿", "学习能力强", "学习毅力", "肯学", "努力", "踏实", "自律", "有毅力"],
        "学习意愿强",
        0.8,
    ),
    (
        ["德语B1", "德语B2", "德语C1", "德语A2", "学过德语", "德语基础", "会德语", "能看德语"],
        "德语潜力",
        0.7,
    ),
    (["英语六级", "英语良好", "英语流利", "雅思", "托福", "英语基础不错"], "语言能力", 0.7),
    (["想去德国", "想留学德国", "赴德", "德国留学", "中德"], "德国意向", 0.7),
    (["想去新加坡", "新加坡留学", "赴新", "新加坡升学"], "新加坡意向", 0.7),
    (["移民", "永居", "留下来", "留在那里", "海外定居"], "移民意向", 0.7),
]


def _age(text: str) -> int | None:
    m = _AGE_PAT.search(text)
    if not m:
        return None
    s = m.group(1) or m.group(2)
    age = int(s)
    return age if 10 <= age <= 70 else None


def _gender(text: str) -> str | None:
    m = _GENDER_PAT.search(text)
    if m and m.group(1):
        return m.group(1)
    if "男性" in text:
        return "男"
    if "女性" in text:
        return "女"
    return None


def _education_raw(text: str) -> str | None:
    """返回学历原始词，交 norm_education 归一。刻意避开志愿表述。"""
    for pat in (_EDU_PAT, _EDU_PAT2):
        m = pat.search(text)
        if m:
            return m.group(1)
    stripped = _EDU_VOLUNTEER.sub(" ", text)
    m = re.search(_EDU_WORDS, stripped)
    return m.group(0) if m else None


def _income_raw(text: str) -> str | None:
    for pat, kind in _INCOME_PATS:
        m = pat.search(text)
        if not m:
            continue
        if kind == "range":
            return f"{m.group(1)}-{m.group(2)}万"
        if kind == "above":
            return f"{m.group(1)}万以上"
        if kind == "exact":
            return f"{m.group(1)}万"
        if kind == "annual":
            return f"{m.group(1)}万"
        # monthly → 年化（月 8000 ≈ 年 9.6 万）
        return f"{float(m.group(1)) * 12 / 10000:.1f}万"
    return None


def _negate_languages(text: str) -> str:
    """去掉被否定的语言表述（「没学过德语」→ 空），供语言抽取与 tags 共用。"""
    return strip_negated_languages(text)


def _language_blob(text: str) -> str:
    """只保留提到语言的分句，避免「收入中等」被 parse_language 当成英语水平。"""
    segs = [s for s in re.split(_SEG_SPLIT, _negate_languages(text)) if _LANG_MARK.search(s)]
    return " ".join(segs)


def _tags(text: str) -> dict:
    tags: dict = {}
    for words, tag, weight in _TAG_RULES:
        if any(w in text for w in words):
            tags[tag] = weight
    return tags


def heuristic_extract(raw_text: str) -> dict:
    """原始客户文本 → 结构化 profile 字段（缺的字段直接省略）。"""
    text = (raw_text or "").strip()
    if not text:
        return {}
    out: dict = {"profile_summary": text[:2000]}
    age = _age(text)
    if age is not None:
        out["age"] = age
    gender = _gender(text)
    if gender:
        out["gender"] = gender
    edu = _education_raw(text)
    if edu:
        out["education_raw"] = edu
    income = _income_raw(text)
    if income:
        out["income_raw"] = income
    else:
        # 无数额时的定性收入（「家里收入中等」）
        m = _QUAL_INCOME.search(text)
        if m and m.group(1) in _QUAL_MAP:
            lvl, rank = _QUAL_MAP[m.group(1)]
            out["income_level"] = lvl
            out["income_rank"] = rank
            out["income_raw"] = m.group(0)
    lang = _language_blob(text)
    if _LANG_MARK.search(lang):
        out["language_ability"] = lang
    # core_demand 用全文，供 extract_needs / derive_country 扫关键词
    out["core_demand"] = text[:500]
    # tags 也要基于否定已剥离的文本，否则「没学过德语」会命中德语潜力标签
    tags = _tags(_negate_languages(text))
    if tags:
        out["tag_weight"] = tags
    return out
