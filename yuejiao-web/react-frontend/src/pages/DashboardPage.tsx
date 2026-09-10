import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, CheckCircle2, ClipboardList, RefreshCw, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchBrief, fetchFunnel, fetchLeads, type LeadItem } from '@/api/enterprise'
import { PageHeader, Panel, StatCard, Button, Badge, Skeleton, Empty, BarChart } from '@/ui'

const statusLabels: Record<string, string> = { new: '新线索', contacting: '跟进中', qualified: '已合格', signed: '已签约', lost: '已流失' }

function numberOf(value: unknown) { return typeof value === 'number' ? value : Number(value || 0) }

const flowSteps = [
  ['01', '口述录入客户', '进入企业助手，说出客户基本信息和意向方向。', '/enterprise'],
  ['02', '数据实时回读', '客户列表、漏斗和负责人信息立即刷新。', '/enterprise/board'],
  ['03', '查看跟进详情', '打开客户档案，补充跟进记录并查看时间线。', '/enterprise'],
  ['04', '完成状态闭环', '通过助手更新状态，再回到看板确认变化。', '/enterprise'],
] as const

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

  return <section>
    <PageHeader
      eyebrow={<><Sparkles size={13} />Workspace</>}
      title="工作台"
      desc="从一句话办理业务，到数据回读和结果追踪，闭环都在这里。"
      actions={
        <Button variant="secondary" icon={<RefreshCw size={14} className={loading ? 'spinner' : ''} />} onClick={() => void load()} disabled={loading}>
          刷新
        </Button>
      }
    />
    {error && <div className="alert"><ClipboardList size={15} /><span>{error}</span></div>}

    <div className="grid-stats" style={{ marginBottom: 20 }}>
      <StatCard label="当前客户" value={loading ? '—' : total} hint="实时客户列表" delay={0} />
      <StatCard label="待办事项" value={loading ? '—' : numberOf(brief.pending_todos)} hint="需要今天处理" delay={60} />
      <StatCard label="已签约" value={loading ? '—' : numberOf(funnel.signed)} hint="当前漏斗存量" delay={120} />
      <StatCard label="签约占比" value={loading ? '—' : signedRate} hint="相对当前客户" delay={180} />
    </div>

    <div className="dash-main">
      <Panel
        title="客户转化漏斗"
        desc="企业助手完成办理后的数据视图"
        actions={<Button variant="ghost" size="sm" icon={<ArrowUpRight size={14} />} onClick={() => navigate('/enterprise/board')}>客户看板</Button>}
        footer={<div className="chart-note">各阶段为当前存量客户数，条形长度相对最大阶段。</div>}
      >
        {loading ? (
          <span style={{ display: 'grid', gap: 20 }}>
            {statusRows.map((row) => <span key={row.key} style={{ display: 'grid', gap: 7 }}><Skeleton height={12} width="30%" /><Skeleton height={8} /></span>)}
          </span>
        ) : (
          <BarChart items={statusRows.map(({ label, value }) => ({ label, value }))} />
        )}
      </Panel>

      <Panel
        title="需要关注的客户"
        desc="新线索、跟进中与已合格"
        actions={<Button variant="ghost" size="sm" icon={<ArrowRight size={14} />} onClick={() => navigate('/enterprise')}>企业助手</Button>}
        flush
      >
        <div style={{ padding: '6px 20px 14px' }}>
          <div className="attention-list">
            {attentionLeads.map((lead) => (
              <button className="attention-item" key={lead.id} onClick={() => navigate('/enterprise')}>
                <span className="avatar">{lead.customer_name.slice(0, 1)}</span>
                <div>
                  <strong>{lead.customer_name}</strong>
                  <small>{[lead.intended_country, lead.intended_major].filter(Boolean).join(' · ') || '未填写意向'}</small>
                </div>
                <Badge tone={lead.status === 'signed' ? 'success' : lead.status === 'contacting' ? 'warning' : 'info'} dot>
                  {statusLabels[lead.status] || lead.status_text}
                </Badge>
              </button>
            ))}
            {!attentionLeads.length && !loading && (
              <Empty tight icon={<CheckCircle2 size={19} />} title="当前没有需要关注的客户" desc="所有跟进中的客户都处于正常节奏。" />
            )}
          </div>
        </div>
      </Panel>
    </div>

    <div className="section-title">
      <h2>演示路径</h2>
      <span className="chart-note">一条链路看懂业务办理与追踪</span>
    </div>
    <div className="dash-flow">
      {flowSteps.map(([index, stepTitle, description, path], i) => (
        <button className="flow-card" key={index} onClick={() => navigate(path)} style={{ animation: `fade-rise var(--dur-3) var(--ease) both`, animationDelay: `${i * 60}ms` }}>
          <span className="flow-card-head">
            <span className="flow-num">{index}</span>
            <ArrowRight size={15} />
          </span>
          <strong>{stepTitle}</strong>
          <p>{description}</p>
        </button>
      ))}
    </div>
  </section>
}
