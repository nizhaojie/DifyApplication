// 等价移植自 Vue 版 前端代码/src/views/report/charts.test.ts:
// 11 个用例逐字保留,断言语义与数值完全一致(锁定「画什么」的规则)。
import { describe, expect, test } from 'vitest'
import { layoutReportCharts, reportChart } from './charts'

function slicesOf(kind: string, numbers: Record<string, unknown>, id: string) {
  return reportChart(layoutReportCharts(kind, numbers), id)?.slices
}

describe('layoutReportCharts — 全域客户经营分析', () => {
  test('empty stock still draws three zero bars and omits wow and groupings', () => {
    const charts = layoutReportCharts('customer_ops', {
      intent_count: 0,
      signed_count: 0,
      lost_count: 0,
      new_intent_count: 0,
      wow: { label: '样本不足', prior_count: 0, delta: null },
      intent: { feature_groups: { intended_country: [], education_level: [], source_channel: [] } },
      signed: { feature_groups: { intended_country: [], education_level: [], source_channel: [] } },
    })

    expect(reportChart(charts, 'periodEndStock')?.slices).toEqual([
      { name: '意向', count: 0 },
      { name: '成交', count: 0 },
      { name: '流失', count: 0 },
    ])
    expect(reportChart(charts, 'newIntentWow')).toBeUndefined()
    expect(reportChart(charts, 'intentCountry')).toBeUndefined()
    expect(reportChart(charts, 'intentEducation')).toBeUndefined()
    expect(reportChart(charts, 'intentChannel')).toBeUndefined()
    expect(reportChart(charts, 'signedCountry')).toBeUndefined()
    expect(charts.map((chart) => chart.id)).toEqual(['periodEndStock'])
  })

  test('sampled wow draws two new-intent bars', () => {
    expect(
      slicesOf(
        'customer_ops',
        {
          intent_count: 2,
          signed_count: 0,
          lost_count: 0,
          new_intent_count: 2,
          wow: { label: null, prior_count: 1, delta: 1 },
        },
        'newIntentWow',
      ),
    ).toEqual([
      { name: '上期', count: 1 },
      { name: '本期', count: 2 },
    ])
  })

  test('insufficient wow sample is not drawn as infinite change', () => {
    expect(
      reportChart(
        layoutReportCharts('customer_ops', {
          intent_count: 1,
          signed_count: 0,
          lost_count: 0,
          new_intent_count: 1,
          wow: { label: '样本不足', prior_count: 0, delta: null },
        }),
        'newIntentWow',
      ),
    ).toBeUndefined()
  })

  test('feature grouping lists become bars; only-其他 still draws; empty lists do not', () => {
    const charts = layoutReportCharts('customer_ops', {
      intent_count: 3,
      signed_count: 1,
      lost_count: 0,
      new_intent_count: 0,
      wow: { label: '样本不足', prior_count: 0, delta: null },
      intent: {
        feature_groups: {
          intended_country: [
            { name: '英国', count: 2 },
            { name: '美国', count: 1 },
          ],
          education_level: [{ name: '其他', count: 3 }],
          source_channel: [],
        },
      },
      signed: {
        feature_groups: {
          intended_country: [{ name: '加拿大', count: 1 }],
          education_level: [],
          source_channel: [{ name: '展会', count: 1 }],
        },
      },
    })

    expect(reportChart(charts, 'intentCountry')?.slices).toEqual([
      { name: '英国', count: 2 },
      { name: '美国', count: 1 },
    ])
    expect(reportChart(charts, 'intentEducation')?.slices).toEqual([{ name: '其他', count: 3 }])
    expect(reportChart(charts, 'intentChannel')).toBeUndefined()
    expect(reportChart(charts, 'signedCountry')?.slices).toEqual([{ name: '加拿大', count: 1 }])
    expect(reportChart(charts, 'signedEducation')).toBeUndefined()
    expect(reportChart(charts, 'signedChannel')?.slices).toEqual([{ name: '展会', count: 1 }])
  })
})

describe('layoutReportCharts — 员工日报智能汇总', () => {
  test('coverage ring is submitted vs missing with expected in the center, never a third slice', () => {
    const chart = reportChart(
      layoutReportCharts('weekly_summary', {
        coverage: { expected_count: 14, submitted_count: 2, missing_count: 12 },
      }),
      'coverage',
    )

    expect(chart?.shape).toBe('ring')
    expect(chart?.centerLabel).toBe('应提交 14')
    expect(chart?.slices).toEqual([
      { name: '已提交', count: 2 },
      { name: '未提交', count: 12 },
    ])
    expect(layoutReportCharts('daily_summary', {
      coverage: { expected_count: 14, submitted_count: 0, missing_count: 14 },
    }).map((item) => item.id)).toEqual(['coverage'])
  })

  test('empty coverage still draws two zero-capable slices', () => {
    expect(
      slicesOf(
        'weekly_summary',
        { coverage: { expected_count: 14, submitted_count: 0, missing_count: 14 } },
        'coverage',
      ),
    ).toEqual([
      { name: '已提交', count: 0 },
      { name: '未提交', count: 14 },
    ])
  })
})

describe('layoutReportCharts — 学生心理健康周报', () => {
  test('emotion tags become bars; empty tags are omitted; only-其他 still draws', () => {
    expect(
      slicesOf(
        'psych_weekly',
        {
          emotion_tags: [
            { name: '焦虑', count: 2 },
            { name: '低落', count: 1 },
          ],
          week_risk_count: 0,
          watchlist_count: 0,
        },
        'emotionTags',
      ),
    ).toEqual([
      { name: '焦虑', count: 2 },
      { name: '低落', count: 1 },
    ])
    expect(
      reportChart(
        layoutReportCharts('psych_weekly', { emotion_tags: [], week_risk_count: 0, watchlist_count: 0 }),
        'emotionTags',
      ),
    ).toBeUndefined()
    expect(
      slicesOf('psych_weekly', { emotion_tags: [{ name: '其他', count: 1 }], week_risk_count: 0, watchlist_count: 0 }, 'emotionTags'),
    ).toEqual([{ name: '其他', count: 1 }])
  })

  test('week risk vs watchlist is two bars even when both are zero, never a ring', () => {
    const empty = reportChart(
      layoutReportCharts('psych_weekly', { emotion_tags: [], week_risk_count: 0, watchlist_count: 0 }),
      'weekRiskVsWatch',
    )
    expect(empty?.shape).toBe('bar')
    expect(empty?.slices).toEqual([
      { name: '本周风险', count: 0 },
      { name: '持续关注', count: 0 },
    ])

    expect(
      slicesOf('psych_weekly', { week_risk_count: 1, watchlist_count: 2 }, 'weekRiskVsWatch'),
    ).toEqual([
      { name: '本周风险', count: 1 },
      { name: '持续关注', count: 2 },
    ])
  })
})

describe('layoutReportCharts — 投诉处理周报', () => {
  test('empty report draws handling zeros, omits wow and categories and unrated-as-zero', () => {
    const charts = layoutReportCharts('complaint_weekly', {
      period_complaint_count: 0,
      wow: { label: '样本不足', prior_count: 0, delta: null },
      categories: [],
      handling: { resolved_or_closed_count: 0, open_count: 0 },
      satisfaction: { label: '暂无评价', average: null, rated_count: 0, unrated_count: 0 },
    })

    expect(reportChart(charts, 'handlingStatus')?.shape).toBe('ring')
    expect(reportChart(charts, 'handlingStatus')?.slices).toEqual([
      { name: '已解决/已关闭', count: 0 },
      { name: '未决', count: 0 },
    ])
    expect(reportChart(charts, 'complaintWow')).toBeUndefined()
    expect(reportChart(charts, 'complaintCategories')).toBeUndefined()
    expect(reportChart(charts, 'ratedVsUnrated')).toBeUndefined()
    expect(charts.map((chart) => chart.id)).toEqual(['handlingStatus'])
  })

  test('sampled wow and categories and rated counts draw; 暂无评价 does not become a 0-score chart', () => {
    const charts = layoutReportCharts('complaint_weekly', {
      period_complaint_count: 2,
      wow: { label: null, prior_count: 1, delta: 1 },
      categories: [
        { name: '签证办理', count: 2 },
        { name: '其他', count: 1 },
      ],
      handling: { resolved_or_closed_count: 1, open_count: 1 },
      satisfaction: { label: null, average: 4, rated_count: 2, unrated_count: 1 },
    })

    expect(reportChart(charts, 'complaintWow')?.slices).toEqual([
      { name: '上期', count: 1 },
      { name: '本期', count: 2 },
    ])
    expect(reportChart(charts, 'complaintCategories')?.slices).toEqual([
      { name: '签证办理', count: 2 },
      { name: '其他', count: 1 },
    ])
    expect(reportChart(charts, 'ratedVsUnrated')?.shape).toBe('bar')
    expect(reportChart(charts, 'ratedVsUnrated')?.slices).toEqual([
      { name: '已评价', count: 2 },
      { name: '未评价', count: 1 },
    ])
  })

  test('only-其他 category still draws', () => {
    expect(
      slicesOf(
        'complaint_weekly',
        {
          period_complaint_count: 2,
          wow: { label: '样本不足', prior_count: 0, delta: null },
          categories: [{ name: '其他', count: 2 }],
          handling: { resolved_or_closed_count: 0, open_count: 2 },
          satisfaction: { label: '暂无评价', average: null, rated_count: 0, unrated_count: 2 },
        },
        'complaintCategories',
      ),
    ).toEqual([{ name: '其他', count: 2 }])
  })
})
