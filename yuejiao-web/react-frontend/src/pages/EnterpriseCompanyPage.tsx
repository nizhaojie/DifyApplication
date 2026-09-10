import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Building2, Globe, Mail, MapPin, Phone, Quote } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchCompany, fetchOrgs } from '@/api/enterprise'
import { PageHeader, Panel, Button, Skeleton } from '@/ui'

type Org = { id: number; org_name: string; parent_id: number | null; children?: Org[] }
function tree(items: Org[]) { const map = new Map(items.map((item) => [item.id, { ...item, children: [] as Org[] }])); const roots: Org[] = []; items.forEach((item) => { const node = map.get(item.id); if (!node) return; if (item.parent_id && map.has(item.parent_id)) map.get(item.parent_id)!.children!.push(node); else roots.push(node) }); return roots }
function OrgList({ nodes, level = 0 }: { nodes: Org[]; level?: number }) {
  return (
    <div>
      {nodes.map((node) => (
        <div key={node.id}>
          <div className="org-node" style={{ paddingLeft: level * 18 }}><span className="org-dot" />{node.org_name}</div>
          {node.children?.length ? <OrgList nodes={node.children} level={level + 1} /> : null}
        </div>
      ))}
    </div>
  )
}

export function EnterpriseCompanyPage() {
  const navigate = useNavigate()
  const [card, setCard] = useState<Record<string, unknown>>({})
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  async function load() { setLoading(true); try { const [company, orgList] = await Promise.all([fetchCompany(), fetchOrgs()]); setCard(company); setOrgs(orgList as Org[]) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const business = (card.business as string[]) || []
  const departments = (card.departments as string[]) || []
  const orgTree = useMemo(() => tree(orgs), [orgs])

  return <section>
    <PageHeader
      eyebrow={<><Building2 size={13} />Company</>}
      title="公司简介"
      desc={`${String(card.full_name || '粤教服务')}（${String(card.short_name || '企业信息')}）`}
      actions={<Button variant="secondary" icon={<ArrowRight size={14} />} onClick={() => navigate('/enterprise')}>去对话里问</Button>}
    />
    {loading ? (
      <div className="stack">
        <Skeleton height={130} radius={14} />
        <div className="info-grid">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={92} radius={14} />)}</div>
      </div>
    ) : (
      <div className="stack">
        <Panel className="company-hero">
          <span className="company-seal"><Building2 size={24} /></span>
          <div>
            <p className="page-header-eyebrow" style={{ marginBottom: 0 }}>About Us</p>
            <h2>{String(card.intro || '广东省教育服务有限公司')}</h2>
            <p>{String(card.transfer || '')}</p>
          </div>
        </Panel>

        <div className="info-grid">
          <InfoCard icon={<Quote size={14} />} label="使命" value={String(card.mission || '—')} />
          <InfoCard icon={<SparkleMark />} label="价值观" value={String(card.values || '—')} />
          <InfoCard icon={<Phone size={14} />} label="电话" value={String(card.phone || '—')} extra={card.email ? { icon: <Mail size={12} />, text: String(card.email) } : undefined} />
          <InfoCard icon={<MapPin size={14} />} label="地址" value={String(card.address || '—')} extra={card.site ? { icon: <Globe size={12} />, text: String(card.site) } : undefined} />
        </div>

        <div className="grid-2">
          <Panel flush title="主营业务" actions={<span className="data-head-meta">{business.length} 项</span>}>
            <div style={{ padding: '16px 20px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {business.map((item) => <span className="tag" key={item}>{item}</span>)}
              {!business.length && <span className="tag tag--plain">暂无业务信息</span>}
            </div>
          </Panel>
          <Panel flush title="组织架构" actions={<span className="data-head-meta">{orgs.length} 个组织</span>}>
            <div style={{ padding: '14px 20px 20px' }}>
              {orgTree.length ? <OrgList nodes={orgTree} /> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {departments.map((item) => <span className="tag tag--plain" key={item}>{item}</span>)}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    )}
  </section>
}

function SparkleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  )
}

function InfoCard({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string; extra?: { icon: React.ReactNode; text: string } }) {
  return (
    <article className="info-card">
      <span className="info-card-icon">{icon}</span>
      <div style={{ minWidth: 0 }}>
        <small>{label}</small>
        <strong>{value}</strong>
        {extra && <span>{extra.icon}{extra.text}</span>}
      </div>
    </article>
  )
}
