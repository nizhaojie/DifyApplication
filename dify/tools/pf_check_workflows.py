#!/usr/bin/env python3
"""冒烟测试 pf-extract / pf-narrate 两个 Dify 工作流接线。

读取项目根 .env（DIFY_API_BASE / DIFY_EXTRACT_API_KEY / DIFY_NARRATE_API_KEY），
用最小输入调 POST /v1/workflows/run，校验输出键：
  extract → outputs.profile（JSON 文本，含 CustomerProfile 字段）
  narrate → outputs.match_result（JSON 文本，含 match_result/match_reason/...）

用法：  python3 dify/check_workflows.py
退出码 0 = 两个工作流都返回了预期输出键。
"""
import sys
from pathlib import Path

# 项目配置在 yuejiao-admin/app/core/config.py，把 yuejiao-admin 加入 sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "yuejiao-admin"))

import httpx  # noqa: E402

from app.core.config import settings  # noqa: E402


def run(label: str, key: str, inputs: dict, expect_key: str) -> bool:
    if not key:
        print(f"{label}: SKIP（.env 未配置 Key，仍走本地启发式兜底）")
        return False
    base = settings.dify_api_base.rstrip("/")
    try:
        r = httpx.post(
            f"{base}/workflows/run",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"inputs": inputs, "response_mode": "blocking", "user": "pf-check"},
            timeout=120,
        )
    except Exception as e:
        print(f"{label}: FAIL（请求异常：{e}）")
        return False
    if r.status_code != 200:
        print(f"{label}: FAIL（HTTP {r.status_code} {r.text[:200]}）")
        return False
    out = r.json().get("data", {}).get("outputs")
    if not isinstance(out, dict) or expect_key not in out:
        print(f"{label}: FAIL（outputs 缺少 {expect_key}：{str(out)[:200]}）")
        return False
    print(f"{label}: OK → outputs.{expect_key} = {str(out[expect_key])[:160]}")
    return True


def main() -> int:
    ok = True
    # extract：原始文本 → profile
    ok &= run(
        "extract",
        settings.dify_extract_api_key,
        {"raw_text": "客户：张某，25岁，男，高中毕业，河南郑州，"
         "想做中德合作项目，机电一体化背景，英语一般，动手能力较强。"},
        "profile",
    )
    # narrate：profile + assessments + match_prompts（均为 JSON 字符串）→ match_result
    ok &= run(
        "narrate",
        settings.dify_narrate_api_key,
        {
            "profile": '{"name":"张某","age":25,"education_level":"高中","needs":["转换赛道"],"background_keywords":["机电"]}',
            "assessments": '[{"product_line":"中德精英人才共建计划","match_result":"matched","match_score":78.0,"matched_labels":["年龄18-35","高中及以上","动手能力强"],"candidate_programs":[{"programs":["机电一体化技术"],"category":"工科","rationale":"机电背景匹配"}]}]',
            "match_prompts": '{"中德精英人才共建计划":"年龄18-35、高中及以上学历、动手能力强者优先"}',
        },
        "match_result",
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
