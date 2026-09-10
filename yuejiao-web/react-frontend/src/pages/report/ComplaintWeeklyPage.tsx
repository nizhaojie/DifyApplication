// 等价移植自 Vue 版 前端代码/src/views/report/complaint-weekly.vue:
// 章节(本期新建总量与环比/分类/处理状态与时效/未决预警/满意度/薄弱环节建议)与文案逐字照搬。
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
          <h1>投诉处理周报</h1>
          <p>选定周期后手动生成。数字来自工单表，叙述与建议来自洞察。</p>
        </div>
        <div className="actions">
          <div className="period-control">
            <span className="period-range">{periodLabel}</span>
            <DatePicker
              className="period-picker"
              picker="week"
              value={dayjs(weekDate)}
              placeholder="选择周期"
              allowClear={false}
              onChange={onPickWeek}
            />
          </div>
          <Button type="primary" loading={generating} onClick={() => void onGenerate()}>
            手动生成
          </Button>
        </div>
      </header>

      {failure && (
        <Alert className="fail" type="error" title={failure} closable={false} showIcon />
      )}

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

                <section className="chapter">
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

                <section className="chapter">
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

                <section className="chapter">
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

                <section className="chapter">
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

                <section className="chapter">
                  <h3>薄弱环节建议</h3>
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
          {!history.length && <p className="hint">还没有已完成的投诉处理周报。</p>}
        </aside>
      </div>
    </section>
  )
}
