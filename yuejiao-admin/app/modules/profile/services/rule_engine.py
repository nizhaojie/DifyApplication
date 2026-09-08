"""规则引擎：加载 profile_rule，对结构化 profile 按各产品线打分 + 映射细分专业。

rule_content JSON 约定：
{
  "conditions": [ {"field":"age","op":"between","value":[18,35],"weight":15,"label":"年龄18-35"}, ... ],
  "program_map": [ {"match":{"education_level":["中专","中职","技校"],"background_keywords":["机电"]},
                          "programs":["机电一体化技术",...], "category":"高端制造","rationale":"..."} , ...],
  "thresholds": {"matched":60,"partial":40}
}
算子 op: between | in | not_in | gte | lte | contains_any | not_contains_any | truthy | eq
"""

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.modules.profile.models.pf import ProfileRule
from app.modules.profile.schemas.profile import CustomerProfile


@dataclass
class ProductAssessment:
    product_line: str
    rule_name: str
    match_result: str               # matched / partial / not_matched
    match_score: float
    matched_labels: list[str] = field(default_factory=list)
    candidate_programs: list[dict] = field(default_factory=list)   # [{programs,category,rationale}]


class RuleEngine:
    def __init__(self, db: Session):
        self.rules: list[ProfileRule] = (
            db.query(ProfileRule)
            .filter(ProfileRule.status == 1)
            .order_by(ProfileRule.priority.desc())
            .all()
        )

    def evaluate(self, profile: CustomerProfile) -> list[ProductAssessment]:
        results = []
        for rule in self.rules:
            content = rule.rule_content or {}
            conds = content.get("conditions", [])
            total = sum(c.get("weight", 0) for c in conds) or 1
            sat = 0
            labels = []
            for c in conds:
                if self._eval(c, profile):
                    sat += c.get("weight", 0)
                    if c.get("label"):
                        labels.append(c["label"])
            score = round(sat / total * 100, 2)
            thr = content.get("thresholds", {"matched": 60, "partial": 40})
            if score >= thr.get("matched", 60):
                mr = "matched"
            elif score >= thr.get("partial", 40):
                mr = "partial"
            else:
                mr = "not_matched"
            programs = self._map_programs(content.get("program_map", []), profile)
            results.append(
                ProductAssessment(
                    product_line=rule.product_line,
                    rule_name=rule.rule_name,
                    match_result=mr,
                    match_score=score,
                    matched_labels=labels,
                    candidate_programs=programs,
                )
            )
        results.sort(key=lambda r: r.match_score, reverse=True)
        return results

    # ---------- 算子 ----------
    def _eval(self, cond: dict, p: CustomerProfile) -> bool:
        field = cond.get("field")
        op = cond.get("op", "eq")
        val = cond.get("value")
        cur = getattr(p, field, None) if field else None
        try:
            if op == "between":
                lo, hi = val[0], val[1]
                return cur is not None and lo <= cur <= hi
            if op == "in":
                if cur is None:
                    return False
                if isinstance(cur, str):
                    return cur in val or any(v in cur for v in val if isinstance(v, str))
                return cur in val
            if op == "not_in":
                if cur is None:
                    return True
                return not (cur in val or (isinstance(cur, str) and any(v in cur for v in val if isinstance(v, str))))
            if op == "gte":
                return cur is not None and cur >= val
            if op == "lte":
                return cur is not None and cur <= val
            if op == "contains_any":
                if cur is None:
                    return False
                if isinstance(cur, list):
                    return bool(set(cur) & set(val))
                if isinstance(cur, str):
                    return any(v in cur for v in val)
                return cur in val
            if op == "not_contains_any":
                # 列表/字符串字段不包含 val 中任一值 → True（用于"非移民导向"等排除信号）
                if cur is None:
                    return True
                if isinstance(cur, list):
                    return not bool(set(cur) & set(val))
                if isinstance(cur, str):
                    return not any(v in cur for v in val)
                return cur not in val
            if op == "truthy":
                return bool(cur)
            if op == "eq":
                return cur == val
        except Exception:
            return False
        return False

    # ---------- 细分专业映射 ----------
    def _map_programs(self, program_map: list[dict], p: CustomerProfile) -> list[dict]:
        out = []
        for entry in program_map:
            match = entry.get("match", {})
            if self._match_program(match, p):
                out.append(
                    {
                        "programs": entry.get("programs", []),
                        "category": entry.get("category", ""),
                        "rationale": entry.get("rationale", ""),
                    }
                )
        return out

    def _match_program(self, match: dict, p: CustomerProfile) -> bool:
        for key, val in match.items():
            if key == "age_min":
                if p.age is None or p.age < val:
                    return False
            elif key == "age_max":
                if p.age is None or p.age > val:
                    return False
            else:
                cur = getattr(p, key, None)
                if isinstance(val, list):
                    if isinstance(cur, list):
                        if not (set(cur) & set(val)):
                            return False
                    elif isinstance(cur, str):
                        if not (cur in val or any(v in cur for v in val if isinstance(v, str))):
                            return False
                    elif cur not in val:
                        return False
                else:
                    if cur != val:
                        return False
        return True
