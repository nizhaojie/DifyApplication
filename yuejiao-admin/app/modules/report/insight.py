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


class FixedInsightAdapter:
    def narrate(self, kind: str, numbers: dict) -> dict:
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
