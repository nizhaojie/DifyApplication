import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, CalendarDays, FileBarChart, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchCurrentReport, fetchReportHistory, generateReport, type ReportKind, type ReportRecord } from '@/api/report'

type JsonRecord = Record<string, any>
const titles: Record<ReportKind, { title: string; subtitle: string }> = {
  customer_ops: { title: '全域客户经营分析', subtitle: '人数来自客户经营数据，洞察用于复盘意向、成交、流失和跟进停滞。' },
  daily_summary: { title: '员工日报智能汇总', subtitle: '按日或按周汇总日报提交覆盖、核心进展和需要协调的风险。' },
  weekly_summary: { title: '员工日报周汇总', subtitle: '按周汇总员工日报提交覆盖、进展、产出和风险。' },
  psych_weekly: { title: '学生心理健康周报', subtitle: '只展示学生姓名、风险级别和节点，不展示心理记录原话。' },
  complaint_weekly: { title: '投诉处理周报', subtitle: '查看工单量、类别、处理时效、未决预警和满意度。' },
}

function isoToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()) }
function record(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {} }
function array(value: unknown): JsonRecord[] { return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === 'object')) : [] }
function text(value: unknown, fallback = '—'): string { if (value == null || value === '') return fallback; if (Array.isArray(value)) return value.map((item) => text(item, '')).filter(Boolean).join('、'); if (typeof value === 'object') return Object.entries(value as JsonRecord).map(([key, item]) => `${key}: ${text(item, '')}`).join(' · '); return String(value) }
function itemText(item: JsonRecord) { return text(item.name || item.student_name || item.customer_name || item.title || item.category || item.event_name, text(item)) }
function statusText(status: ReportRecord['status']) { return status === 'completed' ? '已完成' : status === 'failed' ? '生成失败' : '生成中' }

export function ReportPage({ kind }: { kind: ReportKind }) {
  const navigate = useNavigate()
  const [summaryMode, setSummaryMode] = useState<'day' | 'week'>('week')
  const activeKind = kind === 'daily_summary' ? (summaryMode === 'day' ? 'daily_summary' : 'weekly_summary') : kind
  const [date, setDate] = useState(isoToday())
  const [current, setCurrent] = useState<ReportRecord | null>(null)
  const [history, setHistory] = useState<ReportRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function loadCurrent() { setLoading(true); try { setCurrent(await fetchCurrentReport(activeKind, date)) } catch (cause) { setError(cause instanceof Error ? cause.message : '报告加载失败') } finally { setLoading(false) } }
  async function loadHistory() { try { const records = kind === 'daily_summary' ? (await Promise.all([fetchReportHistory('daily_summary'), fetchReportHistory('weekly_summary')])).flat() : await fetchReportHistory(activeKind); setHistory(records.sort((left, right) => right.id - left.id)) } catch (cause) { setError(cause instanceof Error ? cause.message : '报告历史加载失败') } }
  useEffect(() => { void loadCurrent(); void loadHistory() }, [activeKind, date])

  async function generate() { setGenerating(true); setError(''); try { const result = await generateReport(activeKind, date); if (result.status === 'failed') setError(result.error_message || '报告生成失败'); await Promise.all([loadCurrent(), loadHistory()]) } catch (cause) { setError(cause instanceof Error ? cause.message : '报告生成失败') } finally { setGenerating(false) } }
  function openHistory(item: ReportRecord) { if (kind === 'daily_summary') setSummaryMode(item.kind === 'daily_summary' ? 'day' : 'week'); setDate(item.period_start) }

  const numbers = record(current?.content?.numbers)
  const insight = record(current?.content?.insight)
  const metricEntries = useMemo(() => {
    if (activeKind === 'customer_ops') return [['意向客户', numbers.intent_count], ['成交客户', numbers.signed_count], ['流失客户', numbers.lost_count], ['新增意向', numbers.new_intent_count]]
    if (activeKind === 'psych_weekly') return [['有心理记录', numbers.recorded_student_count], ['平均情绪分', numbers.average_emotion_score], ['本周风险', numbers.week_risk_count], ['持续关注', numbers.watchlist_count]]
    if (activeKind === 'complaint_weekly') return [['本期投诉', numbers.period_complaint_count], ['未决事项', record(numbers.handling).open_count], ['已解决/关闭', record(numbers.handling).resolved_or_closed_count], ['未评价', record(numbers.satisfaction).unrated_count]]
    const coverage = record(numbers.coverage)
    return [['应提交', coverage.expected_count], ['已提交', coverage.submitted_count], ['未提交', coverage.missing_count], ['周期', activeKind === 'weekly_summary' ? '本周' : '今日']]
  }, [activeKind, numbers])

  return <section className="report-page-react"><header className="page-heading"><div><div className="eyebrow"><FileBarChart size={14} /> BUSINESS REPORT</div><h1>{titles[kind].title}</h1><p>{titles[kind].subtitle}</p></div><div className="heading-actions"><button className="ghost-button" onClick={() => navigate('/report')}><ArrowLeft size={15} />报告中心</button><button className="ghost-button" onClick={() => { void loadCurrent(); void loadHistory() }}><RefreshCw size={15} className={loading ? 'spin' : ''} />刷新</button></div></header>
    {error && <div className="alert-banner"><AlertCircle size={16} /><span>{error}</span><button onClick={() => setError('')} aria-label="关闭提示"><X size={15} /></button></div>}
    <section className="report-toolbar panel-surface"><div className="report-period"><CalendarDays size={16} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} />{kind === 'daily_summary' && <div className="segmented-control"><button className={summaryMode === 'week' ? 'active' : ''} onClick={() => setSummaryMode('week')}>本周</button><button className={summaryMode === 'day' ? 'active' : ''} onClick={() => setSummaryMode('day')}>今日</button></div>}</div><button className="primary-button" onClick={() => void generate()} disabled={generating}>{generating ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}手动生成</button></section>
    <div className="report-workspace"><article className="panel-surface report-paper">{current ? <><header className="report-paper-head"><span className="eyebrow">CURRENT REPORT · {statusText(current.status)}</span><h2>{current.title}</h2><p>{current.period_start} 至 {current.period_end}</p></header><div className="report-metric-grid">{metricEntries.map(([label, value]) => <div key={label}><span>{label}</span><strong>{text(value, '0')}</strong></div>)}</div><ReportSections kind={activeKind} numbers={numbers} insight={insight} /></> : <div className="report-empty"><FileBarChart size={28} /><h2>这一周期还没有报告</h2><p>选定日期后手动生成，结果会落库并出现在历史记录中。</p></div>}</article><aside className="panel-surface report-history"><div className="section-title"><div><div className="eyebrow">ARCHIVE</div><h2>报告历史</h2></div><span>{history.length} 条</span></div>{history.map((item) => <button className={`history-item ${current?.id === item.id ? 'on' : ''}`} key={item.id} onClick={() => openHistory(item)}><strong>{item.period_start} 至 {item.period_end}</strong><span>{item.kind === 'daily_summary' ? '日报' : item.kind === 'weekly_summary' ? '周报' : item.title}</span></button>)}{!history.length && <div className="empty-inline">还没有历史报告</div>}</aside></div>
  </section>
}

function ReportSections({ kind, numbers, insight }: { kind: ReportKind; numbers: JsonRecord; insight: JsonRecord }) {
  const section = (title: string, content: React.ReactNode) => <section className="report-chapter" key={title}><h3>{title}</h3>{content}</section>
  const list = (items: unknown[], empty = '暂无数据') => items.length ? <ul className="report-list">{items.map((item, index) => <li key={index}>{itemText(item as JsonRecord)} · {text((item as JsonRecord).status || (item as JsonRecord).risk_level || (item as JsonRecord).reason || (item as JsonRecord).elapsed_days, '')}</li>)}</ul> : <p className="report-muted">{empty}</p>
  const narrative = (keys: string[]) => { const value = keys.map((key) => insight[key]).find(Boolean); return value ? <p className="report-narrative">{String(value)}</p> : null }
  if (kind === 'customer_ops') return <div className="report-chapters">{section('意向与流失预警', <>{list(array(record(numbers.intent).new_intent), '本周期没有新增意向。')}{list(array(record(numbers.intent).churn_warnings), '没有跟进停滞满 14 天的意向客户。')}{narrative(['intent_narrative'])}</>)}{section('成交路径', <>{list(array(record(numbers.signed).customers), '没有成交客户。')}{narrative(['signed_narrative'])}</>)}{section('流失与建议', <>{list(array(record(numbers.lost).customers), '没有流失客户。')}{narrative(['lost_narrative', 'suggested_action'])}</>)}</div>
  if (kind === 'psych_weekly') return <div className="report-chapters">{section('整体态势', <>{list(array(numbers.emotion_tags), '本期无情绪标签可计。')}{narrative(['overview_narrative'])}</>)}{section('本周风险学生', <>{list(array(numbers.week_risk_students), '本周没有未解除的风险学生。')}{narrative(['week_risk_narrative'])}</>)}{section('持续关注与节点', <>{list(array(numbers.watchlist_students), '没有需要持续关注的学生。')}{list(array(numbers.approaching_nodes), '没有临近节点。')}{narrative(['watchlist_narrative', 'approaching_node_narrative', 'suggested_action'])}</>)}</div>
  if (kind === 'complaint_weekly') return <div className="report-chapters">{section('投诉分类', <>{list(array(numbers.categories), '本期无分类可计。')}{narrative(['category_narrative', 'volume_narrative'])}</>)}{section('处理状态与时效', <>{list(array(record(numbers.handling).items), '暂无处理明细。')}{list(array(numbers.open_complaints), '没有超过 3 天的未决投诉。')}{narrative(['handling_narrative', 'open_alert_narrative'])}</>)}{section('满意度与建议', <>{<p>{record(numbers.satisfaction).label === '暂无评价' ? '暂无评价' : `已评价平均 ${text(record(numbers.satisfaction).average)} 分；未评价 ${text(record(numbers.satisfaction).unrated_count, '0')} 条`}</p>}{narrative(['satisfaction_narrative', 'suggested_action'])}</>)}</div>
  const coverage = record(numbers.coverage)
  return <div className="report-chapters">{section('覆盖率', <>{list(array(coverage.missing), '没有未提交人员。')}{narrative(['coverage_narrative'])}</>)}{section('核心进展', <>{list(array(coverage.submitted), '没有已提交日报可提炼核心进展。')}{narrative(['progress_narrative', 'output_narrative'])}</>)}{section('风险与协调建议', <>{narrative(['risk_narrative', 'suggested_action']) || <p className="report-muted">暂无风险和协调建议。</p>}</>)}</div>
}
