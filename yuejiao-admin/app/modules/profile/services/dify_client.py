"""Dify 工作流客户端 + 启发式兜底（客户研判模块专用）。

使用 pf_dify_api_base / dify_extract_api_key / dify_narrate_api_key 三个独立配置
（不与客服 / 企业 / 报告模块的 Dify 配置混用），Key 来自 pf-extract / pf-narrate
两个工作流应用。

Dify 不可达 / 未配 Key 时，按 settings.pf_llm_fallback 决定行为：
- extract：无 LLM 无法从纯文本提取 → heuristic 模式用本地规则提取，off 模式返回 None
  （由 assess_service 兜底用原文规范化）
- narrate：用本地启发式从规则引擎结果生成 match_result/reason/推荐
"""

import json
import re

import httpx

from app.core.config import settings
from app.modules.profile.schemas.profile import CustomerProfile
from app.modules.profile.services.rule_engine import ProductAssessment
from app.modules.profile.services.heuristic_extract import heuristic_extract
from app.utils.log import logger


def _jsonish(value) -> dict | None:
    """把 LLM / 工作流的 JSON 字符串解析为 dict；不是对象返回 None。

    Dify 里 LLM 节点常把 JSON 包在 markdown 代码围栏（```json ... ```）里，
    也可能前后带说明文字；qwen3 等推理模型还会先输出 `</think>` 思考链再给
    围栏 JSON，这里都容忍。
    """
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    s = value.strip()
    # 1) 整段直接解析
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except (ValueError, TypeError):
        pass
    # 2) 取最后一个 ```json…``` 围栏块（推理模型的答案通常在最末的围栏里）
    blocks = re.findall(r"```(?:json|JSON)?\s*(.+?)\s*```", s, re.S)
    if blocks:
        try:
            obj = json.loads(blocks[-1].strip())
            return obj if isinstance(obj, dict) else None
        except (ValueError, TypeError):
            pass
    # 3) 兜底：首个 { 到末个 }（若思考链里含 {...} 片段，此路可能解析失败 → None）
    lo, hi = s.find("{"), s.rfind("}")
    if 0 <= lo < hi:
        try:
            obj = json.loads(s[lo : hi + 1])
            return obj if isinstance(obj, dict) else None
        except (ValueError, TypeError):
            return None
    return None


class AIClient:
    def __init__(self):
        self.base = settings.pf_dify_api_base.rstrip("/")
        self.extract_key = settings.dify_extract_api_key
        self.narrate_key = settings.dify_narrate_api_key
        self.fallback = settings.pf_llm_fallback

    # ---------- Dify Workflow ----------
    def _run_workflow(self, api_key: str, inputs: dict) -> dict | None:
        if not api_key:
            return None
        try:
            r = httpx.post(
                f"{self.base}/workflows/run",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"inputs": inputs, "response_mode": "blocking", "user": "pf-assess"},
                timeout=60,
            )
            r.raise_for_status()
            data = r.json().get("data", {})
            return data.get("outputs")
        except Exception as e:
            logger.warning("[pf-dify] workflow 调用失败：%s", e)
            return None

    # ---------- extract ----------
    def extract(self, raw_text: str) -> dict | None:
        """原始文本 → 结构化 profile dict。失败返回 None。"""
        out = self._run_workflow(self.extract_key, {"raw_text": raw_text})
        if out is None:
            # Dify 不可达 / 未配 Key：heuristic 模式用本地规则提取字段，
            # off 模式返回 None（由 assess_service 只用原文摘要兜底）。
            return heuristic_extract(raw_text) if self.fallback == "heuristic" else None
        if isinstance(out, dict):
            # 三种常见接线方式：
            #   1) end 输出 {"profile": {...}}
            #   2) end 直接输出结构化对象
            #   3) LLM 结果被 end 节点当字符串透传 → outputs.profile 是一段 JSON 文本
            for key in ("profile", "profile_text", "result", "output"):
                if key in out:
                    # 命中包装键就只认它，别退回整个 out。
                    # 解析失败意味着 LLM 输出不可用 → 返回 None，让 assess_service
                    # 回退到用「原始客户文本」规范化；否则会把整份客户信息静默丢掉，
                    # 规则引擎对空 profile 打分，结果看着正常其实全错。
                    return _jsonish(out[key])
            return _jsonish(out)
        return _jsonish(out)

    # ---------- narrate ----------
    def narrate(
        self,
        profile: CustomerProfile,
        assessments: list[ProductAssessment],
        match_prompts: dict,
    ) -> dict:
        """结构化 profile + 规则匹配结果 → match_result/match_reason/recommended_programs。"""
        # pf-narrate 工作流的 start 节点用 paragraph（JSON 文本）入参，
        # 故把三段对象序列化为字符串；工作流 LLM 再按 JSON 解析。
        assessments_json = [
            {
                "product_line": a.product_line,
                "match_result": a.match_result,
                "match_score": a.match_score,
                "matched_labels": a.matched_labels,
                "candidate_programs": a.candidate_programs,
            }
            for a in assessments
        ]
        inputs = {
            "profile": json.dumps(profile.model_dump(mode="json"), ensure_ascii=False),
            "assessments": json.dumps(assessments_json, ensure_ascii=False),
            "match_prompts": json.dumps(match_prompts, ensure_ascii=False),
        }
        out = self._run_workflow(self.narrate_key, inputs)
        if isinstance(out, dict):
            # 同 extract：LLM 的 match_result JSON 可能被 end 节点当字符串透传
            mr = out.get("match_result") or out.get("result") or out.get("output")
            if isinstance(mr, str):
                parsed = _jsonish(mr)
                if parsed is not None and parsed.get("match_result"):
                    out = parsed
        if isinstance(out, dict) and out.get("match_result"):
            # 规范 recommended_programs 为 list[str]
            rp = out.get("recommended_programs")
            if isinstance(rp, str):
                rp = _jsonish(rp)
                rp = rp.get("recommended_programs") if isinstance(rp, dict) else rp
                if isinstance(rp, str):
                    rp = [rp]
            if not isinstance(rp, list):
                out["recommended_programs"] = []
            else:
                out["recommended_programs"] = [str(p) for p in rp if p]
            return out
        # 兜底
        return self._heuristic_narrate(assessments)

    # ---------- 启发式兜底 ----------
    def _heuristic_narrate(self, assessments: list[ProductAssessment]) -> dict:
        if not assessments:
            return {
                "match_result": "not_matched",
                "matched_product": None,
                "match_score": 0.0,
                "match_reason": "无可用规则",
                "recommended_programs": [],
            }
        top = assessments[0]
        progs: list[str] = []
        for c in top.candidate_programs:
            for p in c.get("programs", []):
                if p not in progs:
                    progs.append(p)
        labels = top.matched_labels or ["无"]
        reason = (
            f"命中规则：{'; '.join(labels)}。"
            f"候选专业/项目：{', '.join(progs[:3]) if progs else '待进一步匹配'}。"
            f"（本地启发式判定，Dify 未启用）"
        )
        return {
            "match_result": top.match_result,
            "matched_product": top.product_line,
            "match_score": float(top.match_score),
            "match_reason": reason,
            "recommended_programs": progs[:6],
        }
