class InsightError(Exception):
    pass


EMPTY_VOLUME = "本周无新增投诉。"
EMPTY_ACTION = "本周无新增投诉，维持现有处理节奏即可。"

NONEMPTY_INSIGHT = {
    "volume_narrative": "本周期投诉按新建口径汇总。",
    "category_narrative": "分类沿用工单已有值，空为其他。",
    "handling_narrative": "处理时效按最后更新或周期结束计算。",
    "open_alert_narrative": "超三天未决需跟进。",
    "satisfaction_narrative": "满意度只统计已评价。",
    "suggested_action": "优先关闭超三天未决投诉。",
}

EMPTY_DAILY_INSIGHT = {
    "coverage_narrative": "本周期无人提交日报。",
    "progress_narrative": "没有已提交日报可提炼核心进展。",
    "output_narrative": "没有已提交日报可提炼关键产出。",
    "risk_narrative": "没有已提交日报可识别潜在风险。",
    "suggested_action": "提醒应提交人员完成本周期日报。",
}

NONEMPTY_DAILY_INSIGHT = {
    "coverage_narrative": "覆盖率按应提交人员与已提交日报计算。",
    "progress_narrative": "核心进展来自已提交日报的跨人提炼。",
    "output_narrative": "关键产出来自已提交日报。",
    "risk_narrative": "潜在风险来自已提交日报，未提交不当作成效。",
    "suggested_action": "协调未提交人员补交，并跟进已暴露风险。",
}

EMPTY_PSYCH_INSIGHT = {
    "overview_narrative": "本周无人有心理记录。",
    "week_risk_narrative": "本周没有未解除的风险学生。",
    "watchlist_narrative": "没有需要持续关注的学生。",
    "approaching_node_narrative": "没有考务截止日期落在周期前后各七天内。",
    "suggested_action": "维持日常关怀巡视即可。",
}

NONEMPTY_PSYCH_INSIGHT = {
    "overview_narrative": "本周心理记录按人数、标签与均分汇总。",
    "week_risk_narrative": "本周风险学生与持续关注分列。",
    "watchlist_narrative": "持续关注来自中高风险画像。",
    "approaching_node_narrative": "节点临近只列出考务截止日期命中的学生。",
    "suggested_action": "优先关怀本周风险学生，并跟进持续关注名单。",
}


class FixedInsightAdapter:
    def narrate(self, kind: str, numbers: dict) -> dict:
        if kind == "psych_weekly":
            has_watchlist = bool(numbers.get("watchlist_count"))
            has_nodes = bool(numbers.get("approaching_nodes"))
            if (
                numbers.get("recorded_student_count") == 0
                and numbers.get("week_risk_count") == 0
                and not has_watchlist
                and not has_nodes
            ):
                return dict(EMPTY_PSYCH_INSIGHT)
            return dict(NONEMPTY_PSYCH_INSIGHT)
        coverage = numbers.get("coverage")
        if isinstance(coverage, dict):
            if coverage.get("submitted_count") == 0:
                return dict(EMPTY_DAILY_INSIGHT)
            return dict(NONEMPTY_DAILY_INSIGHT)
        if numbers.get("period_complaint_count") == 0:
            return {
                "volume_narrative": EMPTY_VOLUME,
                "category_narrative": "本期无分类可计。",
                "handling_narrative": "本期无处理时效可计。",
                "open_alert_narrative": "没有超过三天的未决投诉。",
                "satisfaction_narrative": "暂无评价。",
                "suggested_action": EMPTY_ACTION,
            }
        return dict(NONEMPTY_INSIGHT)


class FailingInsightAdapter:
    def narrate(self, kind: str, numbers: dict) -> dict:
        raise InsightError("洞察生成失败")
