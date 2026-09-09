import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, ClipboardList, RefreshCw, Sparkles, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchBrief, fetchFunnel, fetchLeads, type LeadItem } from '@/api/enterprise'

const statusLabels: Record<string, string> = { new: '新线索', contacting: '跟进中', qualified: '已合格', signed: '已签约', lost: '已流失' }

function numberOf(value: unknown) { return typeof value === 'number' ? value : Number(value || 0) }

export function DashboardPage() {
  const navigate = useNavigate()
  const [brief, setBrief] = useState<Record<string, unknown>>({})
  const [funnel, setFunnel] = useState<Record<string, number>>({})
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [briefData, funnelData, leadData] = await Promise.all([fetchBrief(), fetchFunnel(), fetchLeads()])
      setBrief(briefData)
      setFunnel(funnelData)
      setLeads(leadData.items)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '工作台数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const statusRows = useMemo(() => Object.entries(statusLabels).map(([key, label]) => ({ key, label, value: funnel[key] || 0 })), [funnel])
  const attentionLeads = useMemo(() => leads.filter((lead) => ['new', 'contacting', 'qualified'].includes(lead.status)).slice(0, 5), [leads])
  const total = leads.length
  const signedRate = total ? `${Math.round(((funnel.signed || 0) / total) * 100)}%` : '0%'

  return <section className="dashboard-page">
    <header className="page-heading">
      <div><div className="eyebrow"><Sparkles size={14} /> DAILY WORKSPACE</div><h1>今天，从这里开始</h1><p>从一句话办理业务，到数据回读和结果追踪，答辩演示所需的闭环都在这里。</p></div>
      <button className="ghost-button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} />刷新工作台</button>
    </header>
    {error && <div className="alert-banner"><ClipboardList size={16} /><span>{error}</span></div>}
    <div className="stat-grid">
      <article className="metric-card"><span>当前客户</span><strong>{loading ? '—' : total}</strong><small>实时客户列表</small></article>
      <article className="metric-card"><span>待办事项</span><strong>{loading ? '—' : numberOf(brief.pending_todos)}</strong><small>需要今天处理</small></article>
      <article className="metric-card"><span>已签约</span><strong>{loading ? '—' : numberOf(funnel.signed)}</strong><small>当前漏斗存量</small></article>
      <article className="metric-card"><span>签约占比</span><strong>{loading ? '—' : signedRate}</strong><small>相对当前客户</small></article>
    </div>
    <div className="dashboard-grid">
      <section className="panel-surface workflow-panel">
        <div className="panel-heading"><div className="heading-icon blue"><BriefcaseBusiness size={18} /></div><div><h2>答辩演示路径</h2><p>一条链路展示业务如何被办理、回读和追踪</p></div></div>
        <div className="workflow-list">
          {[
            ['01', '口述录入客户', '进入企业助手，说出客户基本信息和意向方向。', '/enterprise'],
            ['02', '数据实时回读', '客户列表、漏斗和负责人信息立即刷新。', '/enterprise/board'],
            ['03', '查看跟进详情', '打开客户档案，补充跟进记录并查看时间线。', '/enterprise'],
            ['04', '完成状态闭环', '通过助手更新状态，再回到看板确认变化。', '/enterprise'],
          ].map(([index, title, description, path]) => <button className="workflow-step" key={index} onClick={() => navigate(path)}><span>{index}</span><div><strong>{title}</strong><p>{description}</p></div><ArrowRight size={16} /></button>)}
        </div>
      </section>
      <section className="panel-surface dashboard-side-panel">
        <div className="panel-heading"><div className="heading-icon blue"><UsersRound size={18} /></div><div><h2>当前客户漏斗</h2><p>企业助手完成办理后的数据视图</p></div></div>
        <div className="dashboard-funnel">{statusRows.map((row) => { const max = Math.max(1, ...statusRows.map((item) => item.value)); return <div className="dashboard-funnel-row" key={row.key}><div><span>{row.label}</span><b>{row.value}</b></div><i><em style={{ width: `${row.value ? Math.max(8, row.value / max * 100) : 0}%` }} /></i></div> })}</div>
        <button className="text-button dashboard-link" onClick={() => navigate('/enterprise/board')}>打开客户看板 <ArrowRight size={14} /></button>
      </section>
    </div>
    <section className="panel-surface attention-panel">
      <div className="section-title"><div><div className="eyebrow">NEXT ACTIONS</div><h2>需要关注的客户</h2></div><button className="text-button" onClick={() => navigate('/enterprise')}>进入企业助手 <ArrowRight size={14} /></button></div>
      <div className="attention-list">{attentionLeads.map((lead) => <button className="attention-item" key={lead.id} onClick={() => navigate('/enterprise')}><span className="attention-avatar">{lead.customer_name.slice(0, 1)}</span><div><strong>{lead.customer_name}</strong><small>{[lead.intended_country, lead.intended_major].filter(Boolean).join(' · ') || '未填写意向'}</small></div><span className="status-badge"><i />{statusLabels[lead.status] || lead.status_text}</span></button>)}{!attentionLeads.length && <div className="empty-inline"><CheckCircle2 size={16} />当前没有需要关注的客户</div>}</div>
    </section>
  </section>
}
