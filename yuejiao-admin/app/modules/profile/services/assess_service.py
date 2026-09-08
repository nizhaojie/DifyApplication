"""研判编排：parse → extract → normalize → rule_engine → narrate → 写库。

assess_structured 供黄金集/预提取场景调用（跳过 extract）。
"""

from sqlalchemy.orm import Session

from app.modules.profile.models.pf import CustomerSource, CustomerProfile as CustomerProfileORM, ProfileRule
from app.modules.profile.schemas.profile import CustomerProfile
from app.modules.profile.services.dify_client import AIClient
from app.modules.profile.services.rule_engine import RuleEngine
from app.modules.profile.services.normalize import normalize_from_raw


class AssessService:
    def __init__(self, db: Session, ai: AIClient | None = None):
        self.db = db
        self.ai = ai or AIClient()

    # ---------- 入口 ----------
    def assess_text(self, raw_text: str, operator_id: int | None = None, persist: bool = True) -> dict:
        return self._run(raw_text, "text", None, None, operator_id, persist)

    def assess_file(self, file_bytes: bytes, file_name: str, operator_id: int | None = None, persist: bool = True) -> dict:
        from app.modules.profile.services.parser import parse_pdf, parse_excel, parse_text

        name_l = file_name.lower()
        if name_l.endswith(".pdf"):
            raw = parse_pdf(file_bytes)
            st = "pdf_resume"
        elif name_l.endswith((".xlsx", ".xls")):
            texts = parse_excel(file_bytes)
            raw = texts[0] if texts else ""
            st = "excel"
        else:
            raw = parse_text(file_bytes)
            st = "text"
        return self._run(raw, st, file_name, None, operator_id, persist)

    def assess_structured(self, profile_dict: dict, operator_id: int | None = None, persist: bool = True) -> dict:
        """跳过 extract，直接规范化（黄金集 / 预提取）。"""
        profile = normalize_from_raw(profile_dict)
        return self._finalize(profile, profile_dict, "import", None, None, operator_id, persist)

    # ---------- 内部 ----------
    def _run(self, raw_text: str, source_type: str, file_name: str | None, file_url: str | None,
             operator_id: int | None, persist: bool) -> dict:
        extracted = self.ai.extract(raw_text)
        if not extracted:
            # 无 LLM 提取：用原文做兜底（仅 summary），后续规则靠字段缺失自然低分
            extracted = {"profile_summary": raw_text, "name": None}
        profile = normalize_from_raw(extracted)
        profile.summary = profile.summary or raw_text
        return self._finalize(profile, extracted, source_type, file_name, file_url, operator_id, persist)

    def _finalize(self, profile: CustomerProfile, parse_result: dict, source_type: str,
                  file_name: str | None, file_url: str | None, operator_id: int | None,
                  persist: bool) -> dict:
        assessments = RuleEngine(self.db).evaluate(profile)
        prompts = {
            r.product_line: r.match_prompt
            for r in self.db.query(ProfileRule).filter(ProfileRule.status == 1).all()
        }
        narr = self.ai.narrate(profile, assessments, prompts)

        source_id = None
        cp_id = None
        if persist:
            src = CustomerSource(
                source_type=source_type,
                raw_content=(profile.summary or "")[:65000],
                file_name=file_name,
                file_url=file_url,
                parse_status="success",
                parse_result=parse_result,
                operator_id=operator_id,
            )
            self.db.add(src)
            self.db.flush()
            source_id = src.id

            cp = CustomerProfileORM(
                customer_name=profile.name,
                contact_info=None,
                source_id=src.id,
                background_info=profile.model_dump(mode="json"),
                match_result=narr.get("match_result"),
                matched_product=narr.get("matched_product"),
                match_score=narr.get("match_score"),
                match_reason=narr.get("match_reason"),
                recommended_programs=narr.get("recommended_programs"),
                evaluator_id=operator_id,
            )
            self.db.add(cp)
            self.db.commit()
            self.db.refresh(cp)
            cp_id = cp.id

        return {
            "id": cp_id,
            "source_id": source_id,
            "customer_name": profile.name,
            "match_result": narr.get("match_result"),
            "matched_product": narr.get("matched_product"),
            "match_score": float(narr.get("match_score") or 0),
            "match_reason": narr.get("match_reason"),
            "recommended_programs": narr.get("recommended_programs") or [],
            "background_info": profile.model_dump(mode="json"),
            "assessments": [
                {
                    "product_line": a.product_line,
                    "rule_name": a.rule_name,
                    "match_result": a.match_result,
                    "match_score": float(a.match_score),
                    "matched_labels": a.matched_labels,
                    "candidate_programs": a.candidate_programs,
                }
                for a in assessments
            ],
        }
