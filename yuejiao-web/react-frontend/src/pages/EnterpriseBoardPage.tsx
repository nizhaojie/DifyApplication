import { useEffect, useMemo, useState } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import { fetchFunnel, fetchLeads, type LeadItem } from '@/api/enterprise'
import { PageHeader, Panel, StatCard, Button, Badge, Empty, BarChart } from '@/ui'

const labels: Record<string, string> = { new: '新线索', contacting: '跟进中', qualified: '已合格', signed: '已签约', lost: '已流失' }

export function EnterpriseBoardPage() {
  const [funnel, setFunnel] = useState<Record<string, number>>({})
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [funnelData, leadData] = await Promise.all([fetchFunnel(), fetchLeads()])
      setFunnel(funnelData)
      setLeads(leadData.items)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const countryItems = useMemo(
    () => Object.entries(
      leads.reduce<Record<string, number>>((acc, item) => {
        const country = item.intended_country || '未填写'
        acc[country] = (acc[country] || 0) + 1
        return acc
      }, {}),
    ).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
    [leads],
  )
  const funnelItems = useMemo(
    () => Object.entries(labels).map(([key, label]) => ({ label, value: funnel[key] || 0 })),
    [funnel],
  )
  const signedRate = leads.length ? `${Math.round(((funnel.signed || 0) / leads.length) * 100)}%` : '0%'

  return <section>
    <PageHeader
      eyebrow={<><BarChart3 size={13} />Board</>}
      title="客户看板"
      desc="用一眼看清当前线索状态和意向分布。"
      actions={<Button variant="secondary" icon={<RefreshCw size={14} className={loading ? 'spinner' : ''} />} onClick={() => void load()}>刷新</Button>}
    />
    <div className="stack">
      <div className="grid-stats grid-stats--3">
        <StatCard label="客户总数" value={loading ? '—' : leads.length} hint="全部在册客户" />
        <StatCard label="已签约" value={loading ? '—' : funnel.signed || 0} hint="漏斗签约存量" delay={50} />
        <StatCard label="签约占比" value={loading ? '—' : signedRate} hint="相对客户总数" delay={100} />
      </div>

      <div className="grid-2">
        <Panel title="线索漏斗" desc="各阶段存量客户">
          <BarChart items={funnelItems} />
        </Panel>
        <Panel title="意向国家" desc="客户意向国家分布">
          {countryItems.length ? <BarChart items={countryItems} /> : <Empty tight title="还没有客户意向" desc="录入客户并填写意向国家后，这里会出现分布。" />}
        </Panel>
      </div>

      <Panel flush title="意向客户" actions={<span className="data-head-meta">{leads.length} 条</span>}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>客户</th><th>联系方式</th><th>意向国家</th><th>学历</th><th>状态</th><th>负责人</th></tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td><strong>{lead.customer_name}</strong></td>
                  <td>{lead.contact_info || '—'}</td>
                  <td>{lead.intended_country || '—'}</td>
                  <td>{lead.education_level || '—'}</td>
                  <td><Badge tone="neutral" dot>{lead.status_text}</Badge></td>
                  <td>{lead.owner_name || '—'}</td>
                </tr>
              ))}
              {!leads.length && !loading && (
                <tr><td colSpan={6}><Empty tight title="没有客户数据" desc="先在企业助手里录入客户，看板会实时更新。" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  </section>
}
