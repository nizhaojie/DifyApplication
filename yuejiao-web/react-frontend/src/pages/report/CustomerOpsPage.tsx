// 等价移植自 Vue 版 前端代码/src/views/report/customer-ops.vue:
// 章节(总览/意向/成交/流失/建议动作)、numbers 与 insight 键、文案逐字照搬。
// el-date-picker type="week" → antd DatePicker picker="week"(外层假壳 .period-control 照搬)。
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

const KIND = 'customer_ops' as const

const STATUS_LABEL: Record<string, string> = {
  new: '新分配',
  contacting: '跟进中',
  qualified: '已合格',
  signed: '已成交',
  lost: '已流失',
}

export function CustomerOpsPage() {
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
  const intent = numbers?.intent as Record<string, any> | undefined
  const signed = numbers?.signed as Record<string, any> | undefined
  const lost = numbers?.lost as Record<string, any> | undefined
  const charts = indexReportCharts(KIND, numbers)
  const newIntentRows = (intent?.new_intent ?? []).map((item: { name: string; entered_on: string }) => ({
    name: item.name,
    entered_on: item.entered_on,
  }))
  const churnWarningRows = (intent?.churn_warnings ?? []).map(
    (item: { name: string; last_contact_on: string; stalled_days: number }) => ({
      name: item.name,
      last_contact_on: item.last_contact_on,
      stalled_days: item.stalled_days,
    }),
  )
  const signedRows = (signed?.customers ?? []).map((item: { name: string; status: string }) => ({
    name: item.name,
    status: statusLabel(item.status),
  }))
  const conversionRows = (signed?.conversion_paths ?? []).map(
    (path: { name: string; status: string; follow_ups?: { at: string; content: string }[] }) => ({
      name: path.name,
      status: statusLabel(path.status),
      timeline: path.follow_ups?.length
        ? path.follow_ups.map((step) => `${step.at} · ${step.content}`).join('\n')
        : '没有跟进记录，仅有当前状态。',
    }),
  )
  const lostRows = (lost?.customers ?? []).map((item: { name: string; lost_reason?: string }) => ({
    name: item.name,
    lost_reason: item.lost_reason || '原因未记录',
  }))

  function statusLabel(status: string) {
    return STATUS_LABEL[status] || status
  }

  function wowText() {
    const wow = numbers?.wow
    if (!wow || wow.label === '样本不足') return '样本不足'
    return `较上期 ${wow.delta}（上期新增意向 ${wow.prior_count}）`
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

  useEffect(() => {
    void Promise.all([loadCurrent(), loadHistory()])
    // Vue 的 onMounted 只并行加载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="report-page">
      <header className="toolbar">
        <div>
          <h1>全域客户经营分析</h1>
          <p>选定周期后手动生成。人数是期末存量，洞察只写分组共性、路径、归因与建议，不改写人数。报告出客户姓名，不跳转详情。</p>
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
                  <h3>总览</h3>
                  {charts.periodEndStock && <CountChart chart={charts.periodEndStock} />}
                  {charts.newIntentWow ? (
                    <CountChart chart={charts.newIntentWow} />
                  ) : (
                    <>
                      <p>新增意向 {numbers?.new_intent_count ?? 0} 人</p>
                      <p>环比：{wowText()}</p>
                    </>
                  )}
                  <p>同比：{numbers?.yoy?.label === '样本不足' ? '样本不足' : numbers?.yoy?.label}</p>
                  {insight?.overview_narrative && (
                    <p className="narrative">{insight.overview_narrative}</p>
                  )}
                </section>

                <section className="chapter">
                  <h3>意向</h3>
                  <p>新增进入漏斗</p>
                  {newIntentRows.length ? (
                    <NameTable
                      columns={[
                        { key: 'name', label: '姓名' },
                        { key: 'entered_on', label: '进入漏斗' },
                      ]}
                      rows={newIntentRows}
                    />
                  ) : (
                    <p>本周期没有新增意向。</p>
                  )}
                  <p>特征分组</p>
                  {charts.intentCountry ? (
                    <CountChart chart={charts.intentCountry} />
                  ) : (
                    <>
                      <p className="sub">意向国家</p>
                      <p>暂无意向国家可分组。</p>
                    </>
                  )}
                  {charts.intentEducation ? (
                    <CountChart chart={charts.intentEducation} />
                  ) : (
                    <>
                      <p className="sub">学历</p>
                      <p>暂无学历可分组。</p>
                    </>
                  )}
                  {charts.intentChannel ? (
                    <CountChart chart={charts.intentChannel} />
                  ) : (
                    <>
                      <p className="sub">来源渠道</p>
                      <p>暂无来源渠道可分组。</p>
                    </>
                  )}
                  <p>流失预警（跟进停滞满 14 天）</p>
                  {churnWarningRows.length ? (
                    <NameTable
                      columns={[
                        { key: 'name', label: '姓名' },
                        { key: 'last_contact_on', label: '最近联系' },
                        { key: 'stalled_days', label: '停滞天数' },
                      ]}
                      rows={churnWarningRows}
                    />
                  ) : (
                    <p>没有跟进停滞满 14 天的意向客户。</p>
                  )}
                  {insight?.intent_narrative && <p className="narrative">{insight.intent_narrative}</p>}
                </section>

                <section className="chapter">
                  <h3>成交</h3>
                  {signedRows.length ? (
                    <NameTable
                      columns={[
                        { key: 'name', label: '姓名' },
                        { key: 'status', label: '当前状态' },
                      ]}
                      rows={signedRows}
                    />
                  ) : (
                    <p>没有成交客户。</p>
                  )}
                  <p>转化路径</p>
                  {conversionRows.length > 0 && (
                    <NameTable
                      columns={[
                        { key: 'name', label: '姓名' },
                        { key: 'status', label: '当前状态' },
                        { key: 'timeline', label: '跟进时间线' },
                      ]}
                      rows={conversionRows}
                    />
                  )}
                  <p>高价值特征</p>
                  {charts.signedCountry ? (
                    <CountChart chart={charts.signedCountry} />
                  ) : (
                    <>
                      <p className="sub">意向国家</p>
                      <p>成交样本不足以按意向国家归纳。</p>
                    </>
                  )}
                  {charts.signedEducation ? (
                    <CountChart chart={charts.signedEducation} />
                  ) : (
                    <>
                      <p className="sub">学历</p>
                      <p>成交样本不足以按学历归纳。</p>
                    </>
                  )}
                  {charts.signedChannel ? (
                    <CountChart chart={charts.signedChannel} />
                  ) : (
                    <>
                      <p className="sub">来源渠道</p>
                      <p>成交样本不足以按来源渠道归纳。</p>
                    </>
                  )}
                  {insight?.signed_narrative && <p className="narrative">{insight.signed_narrative}</p>}
                </section>

                <section className="chapter">
                  <h3>流失</h3>
                  {lostRows.length ? (
                    <NameTable
                      columns={[
                        { key: 'name', label: '姓名' },
                        { key: 'lost_reason', label: '流失原因' },
                      ]}
                      rows={lostRows}
                    />
                  ) : (
                    <p>没有流失客户。</p>
                  )}
                  {insight?.lost_narrative && <p className="narrative">{insight.lost_narrative}</p>}
                </section>

                <section className="chapter">
                  <h3>建议动作</h3>
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
          {!history.length && <p className="hint">还没有已完成的全域客户经营分析。</p>}
        </aside>
      </div>
    </section>
  )
}
