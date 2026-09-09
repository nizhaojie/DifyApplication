import { useEffect, useMemo, useState } from 'react'
import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { fetchBrief, fetchFunnel, fetchLeads, type LeadItem } from '@/api/enterprise'
import { BarList } from '@/components/BarList'
import { Refresh, Right, User } from '@/components/elementIcons'
import './DashboardPage.css'

// 超集页面(Vue 版为 EmptyModule 占位):功能保留,视觉归 Vue 体系(.stat-card/.chart-card)。

const STATUS_LABELS: Record<string, string> = {
  new: '新线索',
  contacting: '跟进中',
  qualified: '已合格',
  signed: '已签约',
  lost: '已流失',
}

function numberOf(value: unknown) {
  return typeof value === 'number' ? value : Number(value || 0)
}

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

  useEffect(() => {
    void load()
  }, [])

  const statusRows = useMemo(
    () => Object.entries(STATUS_LABELS).map(([key, label]) => ({ label, value: funnel[key] || 0 })),
    [funnel],
  )
  const attentionLeads = useMemo(
    () => leads.filter((lead) => ['new', 'contacting', 'qualified'].includes(lead.status)).slice(0, 5),
    [leads],
  )
  const total = leads.length
  const signedRate = total ? `${Math.round(((funnel.signed || 0) / total) * 100)}%` : '0%'

  const dash = loading ? '—' : undefined
  void dash

  return (
    <section className="ent-page">
      <header className="ent-head">
        <h1>工作台</h1>
        <div className="head-actions">
          <Button onClick={() => void load()} loading={loading} icon={<Refresh />}>
            刷新工作台
          </Button>
        </div>
      </header>
      {error ? <div className="muted" style={{ color: '#c41e1e', marginBottom: 12 }}>{error}</div> : null}
      <div className="stat-row">
        <div className="stat-card">
          <small>当前客户</small>
          <strong>{loading ? '—' : total}</strong>
        </div>
        <div className="stat-card">
          <small>待办事项</small>
          <strong>{loading ? '—' : numberOf(brief.pending_todos)}</strong>
        </div>
        <div className="stat-card">
          <small>已签约</small>
          <strong>{loading ? '—' : numberOf(funnel.signed)}</strong>
        </div>
        <div className="stat-card">
          <small>签约占比</small>
          <strong>{loading ? '—' : signedRate}</strong>
        </div>
      </div>
      <div className="chart-row">
        <section className="chart-card">
          <h3>答辩演示路径</h3>
          <div className="workflow-list">
            {(
              [
                ['01', '口述录入客户', '进入企业助手，说出客户基本信息和意向方向。', '/enterprise'],
                ['02', '数据实时回读', '客户列表、漏斗和负责人信息立即刷新。', '/enterprise/board'],
                ['03', '查看跟进详情', '打开客户档案，补充跟进记录并查看时间线。', '/enterprise'],
                ['04', '完成状态闭环', '通过助手更新状态，再回到看板确认变化。', '/enterprise'],
              ] as const
            ).map(([index, title, description, path]) => (
              <button className="workflow-step" key={index} type="button" onClick={() => navigate(path)}>
                <span>{index}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <Right />
              </button>
            ))}
          </div>
        </section>
        <section className="chart-card">
          <h3>当前客户漏斗</h3>
          <BarList items={statusRows} />
          <Button type="link" onClick={() => navigate('/enterprise/board')} style={{ padding: 0, marginTop: 8 }}>
            打开客户看板 <Right />
          </Button>
        </section>
      </div>
      <section className="table-card">
        <div className="ent-head" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>
            <User size={16} /> 需要关注的客户
          </h3>
          <Button type="link" onClick={() => navigate('/enterprise')} style={{ padding: 0 }}>
            进入企业助手 <Right />
          </Button>
        </div>
        <div className="attention-list">
          {attentionLeads.map((lead) => (
            <button className="attention-item" key={lead.id} type="button" onClick={() => navigate('/enterprise')}>
              <span className="attention-avatar">{lead.customer_name.slice(0, 1)}</span>
              <div>
                <strong>{lead.customer_name}</strong>
                <small>{[lead.intended_country, lead.intended_major].filter(Boolean).join(' · ') || '未填写意向'}</small>
              </div>
              <span className="status-badge">{STATUS_LABELS[lead.status] || lead.status_text}</span>
            </button>
          ))}
          {!attentionLeads.length ? <p className="muted">当前没有需要关注的客户</p> : null}
        </div>
      </section>
    </section>
  )
}
