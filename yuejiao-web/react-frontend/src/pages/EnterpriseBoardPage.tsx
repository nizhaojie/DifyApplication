import { useEffect, useMemo, useState } from 'react'
import { Empty, Spin, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FunnelChart } from '@/components/FunnelChart'
import { BarList } from '@/components/BarList'
import { fetchFunnel, fetchLeads, type LeadItem } from '@/api/enterprise'

// 等价迁移自 Vue 版 views/enterprise/board.vue(客户看板:漏斗 + 意向国家 + 意向客户表)。

export function EnterpriseBoardPage() {
  const [loading, setLoading] = useState(false)
  const [funnel, setFunnel] = useState<Record<string, number>>({})
  const [leads, setLeads] = useState<LeadItem[]>([])

  const funnelItems = useMemo(
    () => [
      { label: '新线索', value: funnel.new ?? 0, color: '#c41e1e' },
      { label: '跟进中', value: funnel.contacting ?? 0, color: '#d95454' },
      { label: '已合格', value: funnel.qualified ?? 0, color: '#1d1e1f' },
      { label: '已签约', value: funnel.signed ?? 0, color: '#9d1818' },
      { label: '已流失', value: funnel.lost ?? 0, color: '#909399' },
    ],
    [funnel],
  )

  const countryItems = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of leads) {
      const key = item.intended_country || '未填'
      counts[key] = (counts[key] || 0) + 1
    }
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }, [leads])

  const signedRate = useMemo(() => {
    const total = leads.length
    if (!total) return '0%'
    const signed = leads.filter((item) => item.status === 'signed').length
    return `${Math.round((signed / total) * 100)}%`
  }, [leads])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [funnelData, leadData] = await Promise.all([fetchFunnel(), fetchLeads({})])
        setFunnel(funnelData)
        setLeads(leadData.items)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const columns: ColumnsType<LeadItem> = [
    { title: '客户', dataIndex: 'customer_name', width: 120 },
    { title: '电话', dataIndex: 'contact_info', width: 140 },
    { title: '意向国家', dataIndex: 'intended_country', width: 120 },
    { title: '学历', dataIndex: 'education_level', width: 100 },
    { title: '状态', dataIndex: 'status_text', width: 100 },
    { title: '负责人', dataIndex: 'owner_name' },
  ]

  return (
    <Spin spinning={loading}>
      <section className="ent-page">
        <header className="ent-head">
          <div>
            <h1>客户看板</h1>
            <p className="hint">漏斗和意向国家来自当前库里的意向客户。</p>
          </div>
          <div className="stat-row compact">
            <article className="stat-card">
              <small>客户总数</small>
              <strong>{leads.length}</strong>
            </article>
            <article className="stat-card">
              <small>签约占比</small>
              <strong>{signedRate}</strong>
            </article>
          </div>
        </header>

        <div className="chart-row">
          <div className="chart-card">
            <h3>线索漏斗</h3>
            <FunnelChart items={funnelItems} />
          </div>
          <div className="chart-card">
            <h3>意向国家分布</h3>
            {countryItems.length ? (
              <BarList items={countryItems} />
            ) : (
              <Empty description="还没有客户意向" styles={{ image: { height: 72 } }} />
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>意向客户</h3>
          <Table rowKey="id" size="small" columns={columns} dataSource={leads} pagination={false} />
        </div>
      </section>
    </Spin>
  )
}
