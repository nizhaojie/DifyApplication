"""把《用户画像研判规则.docx》的两套规则结构化后 seed 进 profile_rule 表。

运行（先跑 scripts/init_db.py 建表）：
    PYTHONPATH=. .venv/bin/python scripts/seed_profile_rules.py
幂等：按 product_line 先删后插。
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.modules.profile.models.pf import ProfileRule

# ============================================================
# 中德精英人才共建计划
# ============================================================
ZHONGDE_RULE = {
    "rule_name": "中德精英人才共建计划 · 用户画像研判规则",
    "product_line": "中德精英人才共建计划",
    "priority": 10,
    "match_prompt": (
        "你是客户画像研判顾问。依据《中德精英人才共建计划》规则判定客户是否匹配："
        "年龄18-35、高中及以上学历、德语B1或强学习意愿、动手能力强/逻辑强、"
        "有就业/升学/移民需求（移民为强信号）、家庭可承担、能接受线下封闭实训。"
        "输出 match_result(matched/partial/not_matched)、match_reason(必须引用命中的具体规则条目)、"
        "recommended_programs(从候选专业中选1-3个最匹配的，按匹配度排序)。"
        "未命中规则不得宣称匹配；防幻觉。"
    ),
    "rule_content": {
        "conditions": [
            {"field": "age", "op": "between", "value": [18, 35], "weight": 10, "label": "年龄18-35"},
            {"field": "education_level", "op": "in",
             "value": ["高中", "中职中技", "大专", "本科", "硕士", "博士"], "weight": 10, "label": "高中及以上学历"},
            {"field": "de_qualified", "op": "truthy", "weight": 15, "label": "德语B1或强学习意愿"},
            {"field": "hands_on", "op": "truthy", "weight": 15, "label": "动手能力强"},
            {"field": "needs", "op": "contains_any", "value": ["就业", "移民", "升学"], "weight": 10, "label": "就业/升学/移民需求"},
            {"field": "needs", "op": "contains_any", "value": ["移民"], "weight": 15, "label": "移民意愿(强信号)"},
            {"field": "intended_country", "op": "contains_any", "value": ["德国"], "weight": 10, "label": "留学意愿(德)"},
            {"field": "learning_attitude", "op": "truthy", "weight": 5, "label": "接受线下封闭实训"},
            {"field": "logic_strong", "op": "truthy", "weight": 5, "label": "逻辑思维强"},
        ],
        "thresholds": {"matched": 55, "partial": 35},
        "program_map": [
            {"match": {"background_keywords": ["机电", "机械", "数控", "自动化", "电气"]},
             "programs": ["机电一体化技术", "工业机械师", "精密加工与数控技术", "自动化技术"],
             "category": "高端制造与精密技术", "rationale": "动手能力强、工科背景对口德国工业4.0"},
            {"match": {"background_keywords": ["汽车", "汽修", "车企"]},
             "programs": ["汽车机电一体化（乘用车）", "电动汽车与高压系统", "车身与车辆制造技术"],
             "category": "汽车工程与新能源", "rationale": "汽车工业背景，紧贴德国汽车产业转型"},
            {"match": {"background_keywords": ["建筑", "土木", "工程管理"]},
             "programs": ["建筑工程与项目管理", "建筑设备与能源技术", "金属构造与焊接技术"],
             "category": "建筑与基础设施", "rationale": "基建背景，德国基建维护需求大、移民友好"},
            {"match": {"background_keywords": ["计算机", "信息", "软件", "IT"]},
             "programs": ["应用软件开发", "IT系统集成与网络安全"],
             "category": "信息技术与数字化", "rationale": "IT背景，德国IT人才缺口大"},
            {"match": {"background_keywords": ["护理", "医疗", "护士"]},
             "programs": ["综合护理与健康管理", "老年康养与康复治疗"],
             "category": "医疗健康与大健康", "rationale": "医护背景对口德国护士缺口"},
            {"match": {"background_keywords": ["酒店", "航空", "餐饮", "服务", "商贸", "会计"]},
             "programs": ["酒店与餐饮管理", "航空地勤与物流管理"],
             "category": "酒店、航空与服务管理", "rationale": "服务/商贸背景可跨专业选择"},
            {"match": {"background_keywords": ["管理"]},
             "programs": ["酒店与餐饮管理", "建筑工程与项目管理"],
             "category": "跨专业管理方向", "rationale": "语言/管理背景可走管理类方向"},
        ],
    },
}

# ============================================================
# 新加坡国际本硕升学计划
# ============================================================
SINGAPORE_RULE = {
    "rule_name": "新加坡国际本硕升学计划 · 用户画像研判规则",
    "product_line": "新加坡国际本硕升学计划",
    "priority": 10,
    "match_prompt": (
        "你是客户画像研判顾问。依据《新加坡国际本硕升学计划》规则判定客户是否匹配："
        "全国招生无地域限制；按学历/年龄映射学制（初中→2+2/2+2+1；高中/中职中技→0.5/1+2/0.5/1+2+1；"
        "职高中专中职技校≥17→6+6酒店/9+6航空大专；专科→一年制专升本；本科→一年制本升硕）；"
        "家庭中等以上收入（四年学费约30-31万）；有升学/学历提升/就业需求（移民导向则中德更合适）。"
        "输出 match_result、match_reason(引用命中的学制映射与条件)、recommended_programs(最匹配的1-2个子项目)。"
        "防幻觉：未命中不得宣称匹配。"
    ),
    "rule_content": {
        "conditions": [
            {"field": "education_level", "op": "in",
             "value": ["初中", "高中", "中职中技", "大专", "本科"], "weight": 10, "label": "学历可映射学制"},
            {"field": "needs", "op": "contains_any",
             "value": ["升学", "学历提升", "落户", "转换赛道"], "weight": 15, "label": "升学/学历提升需求"},
            {"field": "income_rank", "op": "gte", "value": 2, "weight": 15, "label": "家庭中等以上收入(30万学费)"},
            {"field": "age", "op": "between", "value": [14, 40], "weight": 5, "label": "年龄14-40"},
            {"field": "intended_country", "op": "contains_any", "value": ["新加坡"], "weight": 10, "label": "留学意愿(新加坡)"},
            {"field": "tags", "op": "contains_any",
             "value": ["留学意愿", "经济基础", "经济实力", "学历提升", "英语"], "weight": 5, "label": "留学意愿/经济基础"},
            {"field": "needs", "op": "not_contains_any", "value": ["移民"], "weight": 10, "label": "非移民导向(否则中德更合适)"},
        ],
        "thresholds": {"matched": 55, "partial": 35},
        "program_map": [
            {"match": {"education_level": ["初中"]},
             "programs": ["2+2新加坡定向本科班", "2+2+1本硕连读"],
             "category": "初中升学", "rationale": "初中毕业可经2+2升本科乃至硕士"},
            {"match": {"education_level": ["高中"]},
             "programs": ["0.5/1+2新加坡定向本科班", "0.5/1+2+1本硕连读"],
             "category": "高中升学", "rationale": "高中/高二在读走预科+本科/+1硕士"},
            {"match": {"education_level": ["中职中技"], "age_min": 17},
             "programs": ["6+6酒店运营大专就业班", "9+6航空运营大专就业班"],
             "category": "中职就业大专", "rationale": "职高中专中职技校≥17岁可读大专就业班，带薪实习解决就业"},
            {"match": {"education_level": ["大专"], "background_keywords": ["酒店", "航空", "餐饮", "服务", "商贸", "会计"]},
             "programs": ["6+6酒店运营大专就业班", "9+6航空运营大专就业班"],
             "category": "专科服务就业", "rationale": "专科+服务背景可走6+6/9+6大专就业班"},
            {"match": {"education_level": ["大专"]},
             "programs": ["一年制专升本"],
             "category": "专科升本", "rationale": "国内专科→新加坡一年制全日制本科"},
            {"match": {"education_level": ["本科"]},
             "programs": ["一年制本升硕"],
             "category": "本科升硕", "rationale": "国内本科→新加坡一年制硕士"},
        ],
    },
}

RULES = [ZHONGDE_RULE, SINGAPORE_RULE]


def seed():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(settings.sync_database_url, pool_pre_ping=True)
    db = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        for r in RULES:
            db.query(ProfileRule).filter(ProfileRule.product_line == r["product_line"]).delete()
            db.add(ProfileRule(
                product_line=r["product_line"],
                rule_name=r["rule_name"],
                rule_content=r["rule_content"],
                match_prompt=r["match_prompt"],
                priority=r.get("priority", 0),
                status=1,
            ))
        db.commit()
        print(f"✅ 已 seed {len(RULES)} 条研判规则：")
        for r in RULES:
            print(f"   - {r['product_line']}  (条件 {len(r['rule_content']['conditions'])} 条 / 专业映射 {len(r['rule_content']['program_map'])} 组)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
