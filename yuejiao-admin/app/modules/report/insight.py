class InsightError(Exception):
    pass


class FixedInsightAdapter:
    def narrate(self, kind: str, numbers: dict) -> dict:
        return {
            "volume_narrative": "本周期投诉按新建口径汇总。",
            "category_narrative": "分类沿用工单已有值，空为其他。",
            "handling_narrative": "处理时效按最后更新或周期结束计算。",
            "open_alert_narrative": "超三天未决需跟进。",
            "satisfaction_narrative": "满意度只统计已评价。",
            "suggested_action": "优先关闭超三天未决投诉。",
        }


class FailingInsightAdapter:
    def narrate(self, kind: str, numbers: dict) -> dict:
        raise InsightError("洞察生成失败")
