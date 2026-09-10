// 等价移植自 antd 版 DailySummaryPage(源自 Vue daily-summary.vue):
// 粒度单选(本周/今日)切换重置日期与 kind(weekly_summary/daily_summary),
// watch([kind, periodStart]) 自动 loadCurrent;历史合并周/日两类并按 id 倒序。
// antd Radio.Group → gqk Segmented;DatePicker → .period-control 假壳 + 原生 date input(禁选未来日期)。
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, FileBarChart, LoaderCircle, Sparkles, X } from 'lucide-react'
import {
  fetchCurrentReport,
  fetchReportHistory,
  generateReport,
  type ReportKind,
  type ReportRecord,
} from '@/api/report'
import { PageHeader, Panel, Button, Empty, Segmented, Skeleton, SkeletonLines, showToast } from '@/ui'
import { CountChart } from './CountChart'
import { NameTable } from './NameTable'
import { indexReportCharts } from './charts'
import {
  periodRangeLabel,
  resolveDayPeriod,
  resolveWeekPeriod,
  shanghaiDate,
  shanghaiIsoDate,
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
        showToast('已生成当前报告')
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
  }, [kind, periodStart])

  // Vue 的 onMounted:并行 loadCurrent + loadHistory
  useEffect(() => {
    void Promise.all([loadCurrent(), loadHistory()])
  }, [])

  function onPickDate(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.value) setSelectedDate(new Date(`${event.target.value}T00:00:00+08:00`))
  }

  return (
    <section className="report-page">
      <PageHeader
        eyebrow={<><FileBarChart size={13} />Business Report</>}
        title="员工日报智能汇总"
        desc="默认看进行中的本周，可切今日。数字来自日报表，叙述与建议来自洞察。"
        actions={
          <>
            <Segmented
              items={[{ key: 'week', label: '本周' }, { key: 'day', label: '今日' }]}
              value={periodGrain}
              onChange={(value) => {
                // Vue:@change="selectedDate = shanghaiDate()"
                setPeriodGrain(value)
                setSelectedDate(shanghaiDate())
              }}
            />
            {periodGrain === 'week' ? (
              <div className="period-control">
                <span className="period-range">
                  <CalendarDays size={14} />
                  {periodLabel}
                </span>
                <input
                  className="period-picker"
                  type="date"
                  max={shanghaiIsoDate()}
                  value={shanghaiIsoDate(selectedDate)}
                  onChange={onPickDate}
                  aria-label="选择周期"
                />
              </div>
            ) : (
              <div className="period-control">
                <span className="period-range">
                  <CalendarDays size={14} />
                  {shanghaiIsoDate(selectedDate)}
                </span>
                <input
                  className="period-picker"
                  type="date"
                  max={shanghaiIsoDate()}
                  value={shanghaiIsoDate(selectedDate)}
                  onChange={onPickDate}
                  aria-label="选择日期"
                />
              </div>
            )}
            <Button variant="primary" loading={generating} onClick={() => void onGenerate()}>
              {generating ? '生成中…' : <><Sparkles size={14} />手动生成</>}
            </Button>
          </>
        }
      />

      {failure && (
        <div className="alert">
          <AlertCircle size={15} />
          <span>{failure}</span>
          <button onClick={() => setFailure('')} aria-label="关闭提示"><X size={14} /></button>
        </div>
      )}

      <div className="report-workspace">
        <Panel flush className="report-paper">
          {(loading || generating) && current && (
            <div className="report-paper-busy" aria-hidden>
              <LoaderCircle size={18} className="spinner" />
            </div>
          )}
          {current ? (
            <>
              <header className="report-paper-head">
                <p className="page-header-eyebrow" style={{ marginBottom: 0 }}>当前报告</p>
                <h2>{current.title}</h2>
                <p>{current.period_start} 至 {current.period_end}</p>
              </header>

              <div className="report-chapters" style={{ paddingTop: 6 }}>
                <section className="report-chapter">
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

                <section className="report-chapter">
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

                <section className="report-chapter">
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

                <section className="report-chapter">
                  <h3>潜在风险</h3>
                  {submittedNames.length > 0 ? (
                    <p>{submittedNames.join('、')}</p>
                  ) : (
                    <p>没有已提交日报可识别潜在风险。</p>
                  )}
                  {insight?.risk_narrative && <p className="narrative">{insight.risk_narrative}</p>}
                </section>

                <section className="report-chapter">
                  <h3>资源与协调建议</h3>
                  <p>{insight?.suggested_action}</p>
                </section>
              </div>
            </>
          ) : loading ? (
            <div style={{ display: 'grid', gap: 16, padding: 4 }}>
              <Skeleton height={22} width="42%" />
              <Skeleton height={12} width="30%" />
              <SkeletonLines rows={5} />
            </div>
          ) : (
            <Empty
              icon={<FileBarChart size={20} />}
              title="这一周期还没有当前报告"
              desc="默认本周，可切今日后手动生成，结果会落库并出现在历史记录中。"
              action={
                <Button variant="primary" onClick={() => void onGenerate()}>
                  生成本期报告
                </Button>
              }
            />
          )}
        </Panel>

        <Panel flush title="报告历史" actions={<span className="data-head-meta">{history.length} 条</span>}>
          <div style={{ padding: '6px 8px 10px' }}>
            {history.map((item) => (
              <button
                key={item.id}
                className={`history-item${current?.id === item.id ? ' active' : ''}`}
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
            {!history.length && <Empty tight title="还没有已完成的员工日报智能汇总" desc="生成过的报告都会留存在这里。" />}
          </div>
        </Panel>
      </div>
    </section>
  )
}
