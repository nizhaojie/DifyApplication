from __future__ import annotations

import json
import urllib.error
import urllib.request

from app.modules.report.insight import InsightError

COMPLAINT_INSIGHT_KEYS = (
    "volume_narrative",
    "category_narrative",
    "handling_narrative",
    "open_alert_narrative",
    "satisfaction_narrative",
    "suggested_action",
)

DAILY_INSIGHT_KEYS = (
    "coverage_narrative",
    "progress_narrative",
    "output_narrative",
    "risk_narrative",
    "suggested_action",
)

PSYCH_INSIGHT_KEYS = (
    "overview_narrative",
    "week_risk_narrative",
    "watchlist_narrative",
    "approaching_node_narrative",
    "suggested_action",
)

INSIGHT_KEYS_BY_KIND = {
    "complaint_weekly": COMPLAINT_INSIGHT_KEYS,
    "daily_summary": DAILY_INSIGHT_KEYS,
    "weekly_summary": DAILY_INSIGHT_KEYS,
    "psych_weekly": PSYCH_INSIGHT_KEYS,
}

INSIGHT_KEYS = COMPLAINT_INSIGHT_KEYS


class DifyWorkflowInsightAdapter:
    def __init__(self, *, base_url: str, api_keys: dict[str, str], timeout: float = 90, user: str = "yuejiao-admin"):
        self._base_url = base_url.rstrip("/")
        self._api_keys = api_keys
        self._timeout = timeout
        self._user = user

    def narrate(self, kind: str, numbers: dict) -> dict:
        keys = INSIGHT_KEYS_BY_KIND.get(kind)
        if not keys:
            raise InsightError("未配置该报告种类的洞察")
        api_key = self._api_keys.get(kind) or ""
        if not api_key:
            raise InsightError("未配置该报告种类的 Dify Workflow")
        raw = self._run(api_key, json.dumps(numbers, ensure_ascii=False))
        return parse_insight(raw, keys)

    def _run(self, api_key: str, aggregates: str) -> object:
        url = f"{self._base_url}/workflows/run"
        payload = {
            "inputs": {"aggregates": aggregates},
            "response_mode": "blocking",
            "user": self._user,
        }
        request = urllib.request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise InsightError(f"洞察生成失败：HTTP {exc.code} {detail[:200]}") from exc
        except urllib.error.URLError as exc:
            raise InsightError(f"洞察生成失败：{exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise InsightError("洞察生成失败：Dify 返回不是 JSON") from exc
        return extract_insight_output(body)


def extract_insight_output(body: dict) -> object:
    data = body.get("data") if isinstance(body.get("data"), dict) else body
    status = data.get("status")
    if status and status != "succeeded":
        raise InsightError(data.get("error") or f"洞察生成失败：{status}")
    outputs = data.get("outputs") or {}
    if "insight" in outputs:
        return outputs["insight"]
    if "text" in outputs:
        return outputs["text"]
    raise InsightError("洞察生成失败：Workflow 未返回 insight")


def parse_insight(raw: object, keys: tuple[str, ...] = INSIGHT_KEYS) -> dict:
    data = _as_object(raw)
    missing = [key for key in keys if not str(data.get(key) or "").strip()]
    if missing:
        raise InsightError("洞察生成失败：返回缺少叙述或建议动作")
    return {key: str(data[key]).strip() for key in keys}


def _as_object(raw: object) -> dict:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        raise InsightError("洞察生成失败：返回不是 JSON")
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise InsightError("洞察生成失败：返回不是 JSON") from exc
    if not isinstance(data, dict):
        raise InsightError("洞察生成失败：返回不是 JSON")
    return data
