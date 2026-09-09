export interface CountSlice {
  name: string
  count: number
}

export interface ReportChart {
  id: string
  shape: 'bar' | 'ring'
  title: string
  centerLabel?: string
  slices: CountSlice[]
}

export function reportChart(charts: ReportChart[], id: string) {
  return charts.find((chart) => chart.id === id)
}

export function indexReportCharts(
  kind: string,
  numbers: Record<string, unknown> | undefined | null,
) {
  const found: Record<string, ReportChart> = {}
  for (const item of layoutReportCharts(kind, numbers)) {
    found[item.id] = item
  }
  return found
}

export function layoutReportCharts(
  kind: string,
  numbers: Record<string, unknown> | undefined | null,
): ReportChart[] {
  if (!numbers) return []
  if (kind === 'customer_ops') return layoutCustomerOps(numbers)
  if (kind === 'daily_summary' || kind === 'weekly_summary') return layoutDailySummary(numbers)
  if (kind === 'psych_weekly') return layoutPsychWeekly(numbers)
  if (kind === 'complaint_weekly') return layoutComplaintWeekly(numbers)
  return []
}

function layoutCustomerOps(numbers: Record<string, unknown>): ReportChart[] {
  const charts: ReportChart[] = [
    barChart('periodEndStock', '期末存量', [
      { name: '意向', count: asCount(numbers.intent_count) },
      { name: '成交', count: asCount(numbers.signed_count) },
      { name: '流失', count: asCount(numbers.lost_count) },
    ]),
  ]
  pushChart(charts, wowChart('newIntentWow', '新增意向', numbers.wow, asCount(numbers.new_intent_count)))
  const intentGroups = asRecord(asRecord(numbers.intent)?.feature_groups)
  const signedGroups = asRecord(asRecord(numbers.signed)?.feature_groups)
  pushChart(charts, groupingChart('intentCountry', '意向国家', intentGroups?.intended_country))
  pushChart(charts, groupingChart('intentEducation', '学历', intentGroups?.education_level))
  pushChart(charts, groupingChart('intentChannel', '来源渠道', intentGroups?.source_channel))
  pushChart(charts, groupingChart('signedCountry', '意向国家', signedGroups?.intended_country))
  pushChart(charts, groupingChart('signedEducation', '学历', signedGroups?.education_level))
  pushChart(charts, groupingChart('signedChannel', '来源渠道', signedGroups?.source_channel))
  return charts
}

function layoutDailySummary(numbers: Record<string, unknown>): ReportChart[] {
  const coverage = asRecord(numbers.coverage) ?? {}
  return [
    ringChart(
      'coverage',
      '覆盖率',
      [
        { name: '已提交', count: asCount(coverage.submitted_count) },
        { name: '未提交', count: asCount(coverage.missing_count) },
      ],
      `应提交 ${asCount(coverage.expected_count)}`,
    ),
  ]
}

function layoutPsychWeekly(numbers: Record<string, unknown>): ReportChart[] {
  const charts: ReportChart[] = []
  pushChart(charts, groupingChart('emotionTags', '情绪标签', numbers.emotion_tags))
  charts.push(
    barChart('weekRiskVsWatch', '本周风险与持续关注', [
      { name: '本周风险', count: asCount(numbers.week_risk_count) },
      { name: '持续关注', count: asCount(numbers.watchlist_count) },
    ]),
  )
  return charts
}

function layoutComplaintWeekly(numbers: Record<string, unknown>): ReportChart[] {
  const charts: ReportChart[] = []
  pushChart(
    charts,
    wowChart('complaintWow', '本期投诉', numbers.wow, asCount(numbers.period_complaint_count)),
  )
  pushChart(charts, groupingChart('complaintCategories', '投诉分类', numbers.categories))
  const handling = asRecord(numbers.handling) ?? {}
  charts.push(
    ringChart('handlingStatus', '处理状态', [
      { name: '已解决/已关闭', count: asCount(handling.resolved_or_closed_count) },
      { name: '未决', count: asCount(handling.open_count) },
    ]),
  )
  const satisfaction = asRecord(numbers.satisfaction)
  if (hasSatisfactionSample(satisfaction)) {
    charts.push(
      barChart('ratedVsUnrated', '评价件数', [
        { name: '已评价', count: asCount(satisfaction.rated_count) },
        { name: '未评价', count: asCount(satisfaction.unrated_count) },
      ]),
    )
  }
  return charts
}

function wowChart(id: string, title: string, wow: unknown, currentCount: number) {
  if (!hasWowSample(wow)) return undefined
  return barChart(id, title, [
    { name: '上期', count: asCount(wow.prior_count) },
    { name: '本期', count: currentCount },
  ])
}

function groupingChart(id: string, title: string, groups: unknown) {
  const slices = asSlices(groups)
  if (!slices) return undefined
  return barChart(id, title, slices)
}

function hasWowSample(wow: unknown): wow is Record<string, unknown> {
  const row = asRecord(wow)
  if (!row) return false
  if (row.label === '样本不足') return false
  return asCount(row.prior_count) > 0
}

function hasSatisfactionSample(
  satisfaction: Record<string, unknown> | undefined,
): satisfaction is Record<string, unknown> {
  if (!satisfaction) return false
  if (satisfaction.label === '暂无评价') return false
  return satisfaction.average != null
}

function barChart(id: string, title: string, slices: CountSlice[]): ReportChart {
  return { id, shape: 'bar', title, slices }
}

function ringChart(id: string, title: string, slices: CountSlice[], centerLabel?: string): ReportChart {
  return { id, shape: 'ring', title, slices, centerLabel }
}

function pushChart(charts: ReportChart[], chart: ReportChart | undefined) {
  if (chart) charts.push(chart)
}

function asRecord(unknownField: unknown): Record<string, unknown> | undefined {
  if (unknownField && typeof unknownField === 'object' && !Array.isArray(unknownField)) {
    return unknownField as Record<string, unknown>
  }
  return undefined
}

function asCount(unknownCount: unknown) {
  return typeof unknownCount === 'number' && Number.isFinite(unknownCount) ? unknownCount : 0
}

function asSlices(unknownGroups: unknown): CountSlice[] | undefined {
  if (!Array.isArray(unknownGroups) || unknownGroups.length === 0) return undefined
  return unknownGroups.map((item) => {
    const row = asRecord(item)
    return { name: String(row?.name ?? ''), count: asCount(row?.count) }
  })
}
