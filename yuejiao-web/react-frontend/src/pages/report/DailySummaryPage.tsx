// 等价移植自 Vue 版 前端代码/src/views/report/daily-summary.vue:
// 粒度单选(本周/今日)切换重置日期与 kind(weekly_summary/daily_summary),
// watch([kind, periodStart]) 自动 loadCurrent;历史合并周/日两类并按 id 倒序。
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, DatePicker, Empty, Radio, Spin } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  fetchCurrentReport,
  fetchReportHistory,
  generateReport,
  type ReportKind,
  type ReportRecord,
} from '@/api/report'
import { toast } from '@/components/feedback'
import { CountChart } from './CountChart'
import { NameTable } from './NameTable'
import { indexReportCharts } from './charts'
import {
  periodRangeLabel,
  resolveDayPeriod,
  resolveWeekPeriod,
  shanghaiDate,
} from './period'
import './report.css'

type PeriodGrain = 'week' | 'day'

export function DailySummaryPage() {
  const [periodGrain, setPeriodGrain] = useState<PeriodGrain>('week')
  const [selectedDate, setSelectedDate] = useState<Date>(() => shanghaiDate())
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState('')
  const [current, setCurrent] = useState<ReportRecord | null>(null)
  const [history, setHistory] = useState<ReportRecord[]>([])

  const kind: ReportKind = periodGrain === 'day' ? 'daily_summary' : 'weekly_summary'
  const resolvedPeriod =
    periodGrain === 'day' ? resolveDayPeriod(selectedDate) : resolveWeekPeriod(selectedDate)
  const periodStart = resolvedPeriod.start
  const periodLabel = periodRangeLabel(resolvedPeriod)
  const coverage = (current?.content?.numbers as Record<string, any> | undefined)?.coverage as
    | Record<string, any>
    | undefined
  const insight = current?.content?.insight as Record<string, string> | undefined
  const submittedNames = (() => {
    const rows = coverage?.submitted as { name: string }[] | undefined
    if (!rows?.length) return []
    return [...new Set(rows.map((row) => row.name))]
  })()
  const missingRows = (() => {
    const rows = coverage?.missing as { name: string }[] | undefined
    if (!rows?.length) return []
    return rows.map((row) => ({ name: row.name }))
  })()
  const charts = indexReportCharts(kind, current?.content?.numbers)

  async function loadCurrent(kindArg?: ReportKind, periodStartArg?: string) {
    setLoading(true)
    try {
      setCurrent(await fetchCurrentReport(kindArg ?? kind, periodStartArg ?? periodStart))
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory() {
    const [weekly, daily] = await Promise.all([
      fetchReportHistory('weekly_summary'),
      fetchReportHistory('daily_summary'),
    ])
    setHistory(
      [...weekly, ...daily]
        .filter((item) => Boolean((item.content?.numbers as { coverage?: unknown } | undefined)?.coverage))
        .sort((left, right) => right.id - left.id),
    )
  }

  async function onGenerate() {
    setGenerating(true)
    setFailure('')
    try {
      const result = await generateReport(kind, periodStart)
      if (result.status === 'failed') {
        setFailure(result.error_message || '生成失败')
      } else {
        toast.success('已生成当前报告')
      }
      await Promise.all([loadCurrent(), loadHistory()])
    } catch (error) {
      setFailure(error instanceof Error ? error.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  async function openHistory(item: ReportRecord) {
    const nextGrain: PeriodGrain = item.kind === 'daily_summary' ? 'day' : 'week'
    const nextDate = shanghaiDate(new Date(`${item.period_start}T00:00:00+08:00`))
    setPeriodGrain(nextGrain)
    setSelectedDate(nextDate)
    setFailure('')
    // Vue 中 openHistory 里 weekDate/kind 已更新后再 loadCurrent,取的是新周期
    const nextPeriod =
      nextGrain === 'day' ? resolveDayPeriod(nextDate) : resolveWeekPeriod(nextDate)
    await loadCurrent(nextGrain === 'day' ? 'daily_summary' : 'weekly_summary', nextPeriod.start)
  }

  // Vue 的 watch([kind, periodStart]):挂载那次不触发,变化后自动 loadCurrent
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    void loadCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, periodStart])

  // Vue 的 onMounted:并行 loadCurrent + loadHistory
  useEffect(() => {
    void Promise.all([loadCurrent(), loadHistory()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPickDate(value: Dayjs | null) {
    if (value) setSelectedDate(value.toDate())
  }

  return (
    <section className="report-page">
      <header className="toolbar">
        <div>
          <h1>员工日报智能汇总</h1>
          <p>默认看进行中的本周，可切今日。数字来自日报表，叙述与建议来自洞察。</p>
        </div>
        <div className="actions">
          <Radio.Group
            buttonStyle="solid"
            value={periodGrain}
            onChange={(event) => {
              // Vue:@change="selectedDate = shanghaiDate()"
              setPeriodGrain(event.target.value as PeriodGrain)
              setSelectedDate(shanghaiDate())
            }}
          >
            <Radio.Button value="week">本周</Radio.Button>
            <Radio.Button value="day">今日</Radio.Button>
          </Radio.Group>
          {periodGrain === 'week' ? (
            <div className="period-control">
              <span className="period-range">{periodLabel}</span>
              <DatePicker
                className="period-picker"
                picker="week"
                showWeek={false}
                value={dayjs(selectedDate)}
                placeholder="选择周期"
                allowClear={false}
                onChange={onPickDate}
              />
            </div>
          ) : (
            <DatePicker
              value={dayjs(selectedDate)}
              format="YYYY-MM-DD"
              placeholder="选择日期"
              allowClear={false}
              onChange={onPickDate}
            />
          )}
          <Button type="primary" loading={generating} onClick={() => void onGenerate()}>
            手动生成
          </Button>
        </div>
      </header>

      {failure && <Alert className="fail" type="error" title={failure} closable={false} showIcon />}

      <div className="workspace">
        <article className="paper">
          <Spin spinning={loading || generating}>
            {current ? (
              <>
                <header className="paper-head">
                  <p className="eyebrow">当前报告</p>
                  <h2>{current.title}</h2>
                  <p className="period">
                    {current.period_start} 至 {current.period_end}
                  </p>
                </header>

                <section className="chapter">
                  <h3>覆盖率</h3>
                  {charts.coverage && <CountChart chart={charts.coverage} />}
                  {missingRows.length > 0 && <p>未提交</p>}
                  {missingRows.length > 0 ? (
                    <NameTable columns={[{ key: 'name', label: '姓名' }]} rows={missingRows} />
                  ) : (
                    <p>没有未提交人员。</p>
                  )}
                  {insight?.coverage_narrative && (
                    <p className="narrative">{insight.coverage_narrative}</p>
                  )}
                </section>

                <section className="chapter">
                  <h3>核心进展</h3>
                  {submittedNames.length > 0 ? (
                    <p>{submittedNames.join('、')}</p>
                  ) : (
                    <p>没有已提交日报可提炼核心进展。</p>
                  )}
                  {insight?.progress_narrative && (
                    <p className="narrative">{insight.progress_narrative}</p>
                  )}
                </section>

                <section className="chapter">
                  <h3>关键产出</h3>
                  {submittedNames.length > 0 ? (
                    <p>{submittedNames.join('、')}</p>
                  ) : (
                    <p>没有已提交日报可提炼关键产出。</p>
                  )}
                  {insight?.output_narrative && (
                    <p className="narrative">{insight.output_narrative}</p>
                  )}
                </section>

                <section className="chapter">
                  <h3>潜在风险</h3>
                  {submittedNames.length > 0 ? (
                    <p>{submittedNames.join('、')}</p>
                  ) : (
                    <p>没有已提交日报可识别潜在风险。</p>
                  )}
                  {insight?.risk_narrative && <p className="narrative">{insight.risk_narrative}</p>}
                </section>

                <section className="chapter">
                  <h3>资源与协调建议</h3>
                  <p>{insight?.suggested_action}</p>
                </section>
              </>
            ) : (
              <Empty description="这一周期还没有当前报告。默认本周，可切今日后手动生成。" />
            )}
          </Spin>
        </article>

        <aside className="history">
          <h2>报告历史</h2>
          <p className="hint">打开同一种类的旧周期（日或周）</p>
          {history.map((item) => (
            <button
              key={item.id}
              className={`history-item${current?.id === item.id ? ' on' : ''}`}
              type="button"
              onClick={() => void openHistory(item)}
            >
              <strong>
                {item.period_start} 至 {item.period_end}
              </strong>
              <span>
                {item.kind === 'daily_summary' ? '日' : '周'} · {item.title}
              </span>
            </button>
          ))}
          {!history.length && <p className="hint">还没有已完成的员工日报智能汇总。</p>}
        </aside>
      </div>
    </section>
  )
}
