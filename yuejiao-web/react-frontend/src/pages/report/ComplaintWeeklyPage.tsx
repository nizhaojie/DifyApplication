// 等价移植自 antd 版 ComplaintWeeklyPage(源自 Vue complaint-weekly.vue):
// 章节(本期新建总量与环比/分类/处理状态与时效/未决预警/满意度/薄弱环节建议)与文案逐字照搬。
import { useEffect, useState } from 'react'
import { AlertCircle, CalendarDays, FileBarChart, LoaderCircle, Sparkles, X } from 'lucide-react'
import {
  fetchCurrentReport,
  fetchReportHistory,
  generateReport,
  type ReportRecord,
} from '@/api/report'
import { PageHeader, Panel, Button, Empty, Skeleton, SkeletonLines, showToast } from '@/ui'
import { CountChart } from './CountChart'
import { NameTable } from './NameTable'
import { indexReportCharts } from './charts'
import { periodRangeLabel, resolveWeekPeriod, shanghaiDate, shanghaiIsoDate } from './period'
import './report.css'

const KIND = 'complaint_weekly' as const

export function ComplaintWeeklyPage() {
  const [weekDate, setWeekDate] = useState<Date>(() => shanghaiDate())
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState('')
  const [current, setCurrent] = useState<ReportRecord | null>(null)
  const [history, setHistory] = useState<ReportRecord[]>([])

  const resolvedPeriod = resolveWeekPeriod(weekDate)
  const periodStart = resolvedPeriod.start
  const periodLabel = periodRangeLabel(resolvedPeriod)
  const numbers = current?.content?.numbers as Record<string, any> | undefined
  const insight = current?.content?.insight as Record<string, string> | undefined
  const charts = indexReportCharts(KIND, numbers)
  const handlingRows = (numbers?.handling?.items ?? []).map(
    (item: { student_name: string; status: string; elapsed_days: number }) => ({
      student_name: item.student_name,
      status: item.status,
      elapsed_days: item.elapsed_days,
    }),
  )
  const openComplaintRows = (numbers?.open_complaints ?? []).map(
    (item: { student_name: string; category: string; elapsed_days: number }) => ({
      student_name: item.student_name,
      category: item.category,
      elapsed_days: item.elapsed_days,
    }),
  )

  async function loadCurrent(periodStartArg?: string) {
    setLoading(true)
    try {
      setCurrent(await fetchCurrentReport(KIND, periodStartArg ?? periodStart))
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory() {
    setHistory(await fetchReportHistory(KIND))
  }

  async function onGenerate() {
    setGenerating(true)
    setFailure('')
    try {
      const result = await generateReport(KIND, periodStart)
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
    const nextDate = shanghaiDate(new Date(`${item.period_start}T00:00:00+08:00`))
    setWeekDate(nextDate)
    setFailure('')
    await loadCurrent(resolveWeekPeriod(nextDate).start)
  }

  function onPickWeek(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.value) return
    const nextDate = new Date(`${event.target.value}T00:00:00+08:00`)
    setWeekDate(nextDate)
    // Vue 的 @change="loadCurrent":立即按新周期拉取
    void loadCurrent(resolveWeekPeriod(nextDate).start)
  }

  // Vue 的 onMounted:并行 loadCurrent + loadHistory
  useEffect(() => {
    void Promise.all([loadCurrent(), loadHistory()])
  }, [])

  return (
    <section className="report-page">
      <PageHeader
        eyebrow={<><FileBarChart size={13} />Business Report</>}
        title="投诉处理周报"
        desc="选定周期后手动生成。数字来自工单表，叙述与建议来自洞察。"
        actions={
          <>
            <div className="period-control">
              <span className="period-range">
                <CalendarDays size={14} />
                {periodLabel}
              </span>
              <input
                className="period-picker"
                type="date"
                value={shanghaiIsoDate(weekDate)}
                onChange={onPickWeek}
                aria-label="选择周期"
              />
            </div>
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
                  <h3>本期新建总量与环比</h3>
                  {charts.complaintWow ? (
                    <CountChart chart={charts.complaintWow} />
                  ) : (
                    <>
                      <p className="lead">本期投诉 {numbers?.period_complaint_count ?? 0} 件</p>
                      <p>
                        环比：
                        {numbers?.wow?.label === '样本不足'
                          ? '样本不足'
                          : `较上期 ${numbers?.wow?.delta}（上期 ${numbers?.wow?.prior_count}）`}
                      </p>
                    </>
                  )}
                  <p>同比：{numbers?.yoy?.label === '样本不足' ? '样本不足' : numbers?.yoy?.label}</p>
                  {insight?.volume_narrative && (
                    <p className="narrative">{insight.volume_narrative}</p>
                  )}
                </section>

                <section className="report-chapter">
                  <h3>分类</h3>
                  {charts.complaintCategories ? (
                    <CountChart chart={charts.complaintCategories} />
                  ) : (
                    <p>本期无分类可计。</p>
                  )}
                  {insight?.category_narrative && (
                    <p className="narrative">{insight.category_narrative}</p>
                  )}
                </section>

                <section className="report-chapter">
                  <h3>处理状态与时效</h3>
                  {charts.handlingStatus && <CountChart chart={charts.handlingStatus} />}
                  {handlingRows.length > 0 && (
                    <NameTable
                      columns={[
                        { key: 'student_name', label: '学生' },
                        { key: 'status', label: '处理状态' },
                        { key: 'elapsed_days', label: '已耗时（天）' },
                      ]}
                      rows={handlingRows}
                    />
                  )}
                  {insight?.handling_narrative && (
                    <p className="narrative">{insight.handling_narrative}</p>
                  )}
                </section>

                <section className="report-chapter">
                  <h3>未决预警</h3>
                  {openComplaintRows.length > 0 ? (
                    <NameTable
                      columns={[
                        { key: 'student_name', label: '学生' },
                        { key: 'category', label: '投诉分类' },
                        { key: 'elapsed_days', label: '已耗时（天）' },
                      ]}
                      rows={openComplaintRows}
                    />
                  ) : (
                    <p>没有超过 3 天的未决投诉。</p>
                  )}
                  {insight?.open_alert_narrative && (
                    <p className="narrative">{insight.open_alert_narrative}</p>
                  )}
                </section>

                <section className="report-chapter">
                  <h3>满意度</h3>
                  {numbers?.satisfaction?.label === '暂无评价' ? (
                    <p>暂无评价</p>
                  ) : (
                    <>
                      {charts.ratedVsUnrated && <CountChart chart={charts.ratedVsUnrated} />}
                      <p>已评价平均 {numbers?.satisfaction?.average} 分</p>
                    </>
                  )}
                  {insight?.satisfaction_narrative && (
                    <p className="narrative">{insight.satisfaction_narrative}</p>
                  )}
                </section>

                <section className="report-chapter">
                  <h3>薄弱环节建议</h3>
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
              desc="选定周期后手动生成，结果会落库并出现在历史记录中。"
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
                <span>{item.title}</span>
              </button>
            ))}
            {!history.length && <Empty tight title="还没有已完成的投诉处理周报" desc="生成过的报告都会留存在这里。" />}
          </div>
        </Panel>
      </div>
    </section>
  )
}
