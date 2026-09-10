// 等价移植自 antd 版 PsychWeeklyPage(源自 Vue psych-weekly.vue):
// 章节(整体态势/本周风险学生/持续关注/节点临近[条件渲染]/疏导建议)、RISK_LABEL、文案逐字照搬。
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

const KIND = 'psych_weekly' as const

const RISK_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const RISK_TABLE_COLUMNS = [
  { key: 'student_name', label: '姓名' },
  { key: 'risk_level', label: '风险等级' },
  { key: 'emotion_tag', label: '情绪标签' },
]


export function PsychWeeklyPage() {
  const [weekDate, setWeekDate] = useState<Date>(() => shanghaiDate())
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [failure, setFailure] = useState('')
  const [current, setCurrent] = useState<ReportRecord | null>(null)
  const [history, setHistory] = useState<ReportRecord[]>([])

  const resolvedPeriod = resolveWeekPeriod(weekDate)
  const periodStart = resolvedPeriod.start
  const periodLabel = periodRangeLabel(resolvedPeriod)
  const numbers = current?.content?.numbers as Record<string, any> | undefined
  const insight = current?.content?.insight as Record<string, string> | undefined
  const charts = indexReportCharts(KIND, numbers)
  const weekRiskRows = (numbers?.week_risk_students ?? []).map(
    (item: { student_name: string; risk_level: string; emotion_tag?: string }) => ({
      student_name: item.student_name,
      risk_level: riskLabel(item.risk_level),
      emotion_tag: item.emotion_tag || '无标签',
    }),
  )
  const watchlistRows = (numbers?.watchlist_students ?? []).map(
    (item: { student_name: string; risk_level: string; emotion_tag?: string }) => ({
      student_name: item.student_name,
      risk_level: riskLabel(item.risk_level),
      emotion_tag: item.emotion_tag || '无标签',
    }),
  )
  const approachingRows = (numbers?.approaching_nodes ?? []).map(
    (item: { student_name: string; title: string; deadline: string }) => ({
      student_name: item.student_name,
      title: item.title,
      deadline: item.deadline,
    }),
  )

  function riskLabel(level: string) {
    return RISK_LABEL[level] || level
  }

  async function loadCurrent(periodStartArg?: string) {
    setIsLoading(true)
    try {
      setCurrent(await fetchCurrentReport(KIND, periodStartArg ?? periodStart))
    } finally {
      setIsLoading(false)
    }
  }

  async function loadHistory() {
    setHistory(await fetchReportHistory(KIND))
  }

  async function onGenerate() {
    setIsGenerating(true)
    setFailure('')
    try {
      const generatedReport = await generateReport(KIND, periodStart)
      if (generatedReport.status === 'failed') {
        setFailure(generatedReport.error_message || '生成失败')
      } else {
        showToast('已生成当前报告')
      }
      await Promise.all([loadCurrent(), loadHistory()])
    } catch (error) {
      setFailure(error instanceof Error ? error.message : '生成失败')
    } finally {
      setIsGenerating(false)
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
        title="学生心理健康周报"
        desc="选定周期后手动生成。数字来自心理记录与预警，叙述与疏导建议来自洞察。报告只出姓名，不出原话。"
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
                max={shanghaiIsoDate()}
                value={shanghaiIsoDate(weekDate)}
                onChange={onPickWeek}
                aria-label="选择周期"
              />
            </div>
            <Button variant="primary" loading={isGenerating} onClick={() => void onGenerate()}>
              {isGenerating ? '生成中…' : <><Sparkles size={14} />手动生成</>}
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
          {(isLoading || isGenerating) && current && (
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
                  <h3>整体态势</h3>
                  <p className="lead">本周有心理记录 {numbers?.recorded_student_count ?? 0} 人</p>
                  {numbers?.average_emotion_score != null ? (
                    <p>平均情绪分 {numbers.average_emotion_score}</p>
                  ) : (
                    <p>暂无情绪分可计。</p>
                  )}
                  {charts.emotionTags ? (
                    <CountChart chart={charts.emotionTags} />
                  ) : (
                    <p>本期无情绪标签可计。</p>
                  )}
                  {insight?.overview_narrative && (
                    <p className="narrative">{insight.overview_narrative}</p>
                  )}
                </section>

                <section className="report-chapter">
                  <h3>本周风险学生</h3>
                  {charts.weekRiskVsWatch && <CountChart chart={charts.weekRiskVsWatch} />}
                  {weekRiskRows.length > 0 ? (
                    <NameTable columns={RISK_TABLE_COLUMNS} rows={weekRiskRows} />
                  ) : (
                    <p>本周没有未解除的风险学生。</p>
                  )}
                  {insight?.week_risk_narrative && (
                    <p className="narrative">{insight.week_risk_narrative}</p>
                  )}
                </section>

                <section className="report-chapter">
                  <h3>持续关注</h3>
                  {watchlistRows.length > 0 ? (
                    <NameTable columns={RISK_TABLE_COLUMNS} rows={watchlistRows} />
                  ) : (
                    <p>没有需要持续关注的学生。</p>
                  )}
                  {insight?.watchlist_narrative && (
                    <p className="narrative">{insight.watchlist_narrative}</p>
                  )}
                </section>

                {approachingRows.length > 0 && (
                  <section className="report-chapter">
                    <h3>节点临近</h3>
                    <NameTable
                      columns={[
                        { key: 'student_name', label: '姓名' },
                        { key: 'title', label: '节点' },
                        { key: 'deadline', label: '截止日期' },
                      ]}
                      rows={approachingRows}
                    />
                    {insight?.approaching_node_narrative && (
                      <p className="narrative">{insight.approaching_node_narrative}</p>
                    )}
                  </section>
                )}

                <section className="report-chapter">
                  <h3>疏导建议</h3>
                  <p>{insight?.suggested_action}</p>
                </section>
              </div>
            </>
          ) : isLoading ? (
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
            {!history.length && <Empty tight title="还没有已完成的学生心理健康周报" desc="生成过的报告都会留存在这里。" />}
          </div>
        </Panel>
      </div>
    </section>
  )
}
