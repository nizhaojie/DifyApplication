"""客户研判黄金集回归测试（自独立项目 customer-profiling 移植）。

用《用户信息数据示例》20 条客户（target_project 作标签）跑研判，
比对 matched_product + recommended_programs 与 target_project。
一致率目标 ≥ 80%（移植前独立项目实测 100%）。

运行（需已建表 + 灌规则；数据库由 DATABASE_URL 决定，默认 admin .env 的 MySQL）：
    PYTHONPATH=. .venv/bin/python tests/profile/run_golden_set.py

注意：本脚本直接调 AssessService.assess_structured（跳过 extract、不入库），
narrate 若 Dify 可达则走真 LLM，否则走本地启发式兜底（match_reason 尾部有标记）。
"""

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

from app.db.session import SessionLocal                      # noqa: E402
from app.modules.profile.services.assess_service import AssessService  # noqa: E402

SAMPLES_PATH = os.path.join(os.path.dirname(__file__), "data", "customer_samples.json")


def expected_product(target: str) -> str | None:
    if "新加坡" in target:
        return "新加坡国际本硕升学计划"
    if "中德" in target:
        return "中德精英人才共建计划"
    return None


def program_matches(recs: list[str], target: str) -> bool:
    if "新加坡" in target:
        tokens = [t for t in ["2+2", "0.5", "1+2", "专升本", "本升硕", "6+6", "9+6", "酒店", "航空"]
                  if t in target]
        return any(any(t in r for t in tokens) for r in recs)
    # 中德：括号内为专业方向，抽类别关键词匹配
    hint = target.split("（", 1)[1].rstrip("）") if "（" in target else target
    core = hint.replace("方向", "")
    CATS = ["机电", "机械", "数控", "自动化", "汽车", "车身", "电动汽车", "建筑",
            "金属构造", "IT", "计算机", "信息", "软件", "护理", "老年", "医疗",
            "酒店", "航空", "餐饮", "电子", "电气", "商贸", "会计", "管理", "服务"]
    cats = [c for c in CATS if c in hint or c in core]
    for r in recs:
        if hint and (hint in r or r in hint):
            return True
        if any(c in r for c in cats):
            return True
    return False


def main() -> int:
    db = SessionLocal()
    svc = AssessService(db)
    with open(SAMPLES_PATH, encoding="utf-8") as f:
        samples = json.load(f)

    passed = 0
    for s in samples:
        raw = dict(s)
        raw.pop("target_project", None)          # 不把标签当特征
        res = svc.assess_structured(raw, persist=False)
        exp = expected_product(s.get("target_project", ""))
        got = res["matched_product"]
        recs = res["recommended_programs"] or []
        prod_ok = got == exp
        prog_ok = program_matches(recs, s.get("target_project", "")) if exp else False
        ok = prod_ok and prog_ok
        passed += 1 if ok else 0
        flag = "✅" if ok else "❌"
        top = res["assessments"][0] if res["assessments"] else {}
        print(
            f"{flag} {s.get('id')} {s.get('name',''):<6} | "
            f"目标={s.get('target_project')} | 推荐={got} / {recs} | 分={res['match_score']}"
        )
        if not ok:
            print(f"     期望产品={exp} 得到={got} 产品对={prod_ok} 专业对={prog_ok} 命中={top.get('matched_labels')}")
    rate = passed / len(samples) * 100
    print(f"\n一致率：{passed}/{len(samples)} = {rate:.0f}%  ({'达标 ≥80%' if rate >= 80 else '未达标'})")
    db.close()
    return 0 if rate >= 80 else 1


if __name__ == "__main__":
    sys.exit(main())
