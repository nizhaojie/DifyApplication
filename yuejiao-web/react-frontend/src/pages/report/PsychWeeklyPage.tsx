// 等价移植自 Vue 版 前端代码/src/views/report/psych-weekly.vue:
// 章节(整体态势/本周风险学生/持续关注/节点临近[条件渲染]/疏导建议)、RISK_LABEL、文案逐字照搬。
import { useEffect, useState } from 'react'
import { Alert, Button, DatePicker, Empty, Spin } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  fetchCurrentReport,
  fetchReportHistory,
  generateReport,
  type ReportRecord,
} from '@/api/report'
import { toast } from '@/components/feedback'
import { CountChart } from './CountChart'
import { NameTable } from './NameTable'
import { indexReportCharts } from './charts'
import { periodRangeLabel, resolveWeekPeriod, shanghaiDate } from './period'
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
        toast.success('已生成当前报告')
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

  function onPickWeek(value: Dayjs | null) {
    if (!value) return
    const nextDate = value.toDate()
    setWeekDate(nextDate)
    // Vue 的 @change="loadCurrent":立即按新周期拉取
    void loadCurrent(resolveWeekPeriod(nextDate).start)
  }

  // Vue 的 onMounted:并行 loadCurrent + loadHistory
  useEffect(() => {
    void Promise.all([loadCurrent(), loadHistory()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="report-page">
      <header className="toolbar">
        <div>
          <h1>学生心理健康周报</h1>
          <p>选定周期后手动生成。数字来自心理记录与预警，叙述与疏导建议来自洞察。报告只出姓名，不出原话。</p>
        </div>
        <div className="actions">
          <div className="period-control">
            <span className="period-range">{periodLabel}</span>
            <DatePicker
              className="period-picker"
              picker="week"
              showWeek={false}
              value={dayjs(weekDate)}
              placeholder="选择周期"
              allowClear={false}
              onChange={onPickWeek}
            />
          </div>
          <Button type="primary" loading={isGenerating} onClick={() => void onGenerate()}>
            手动生成
          </Button>
        </div>
      </header>

      {failure && (
        <Alert className="fail" type="error" title={failure} closable={false} showIcon />
      )}

      <div className="workspace">
        <article className="paper">
          <Spin spinning={isLoading || isGenerating}>
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

                <section className="chapter">
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

                <section className="chapter">
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
                  <section className="chapter">
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

                <section className="chapter">
                  <h3>疏导建议</h3>
                  <p>{insight?.suggested_action}</p>
                </section>
              </>
            ) : (
              <Empty description="这一周期还没有当前报告，选定周期后手动生成。" />
            )}
          </Spin>
        </article>

        <aside className="history">
          <h2>报告历史</h2>
          <p className="hint">打开同一种类的旧周期</p>
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
              <span>{item.title}</span>
            </button>
          ))}
          {!history.length && <p className="hint">还没有已完成的学生心理健康周报。</p>}
        </aside>
      </div>
    </section>
  )
}
