import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Spin, Tag, Tree } from 'antd'
import { fetchCompany, fetchOrgs, type OrgItem } from '@/api/enterprise'

// 等价迁移自 Vue 版 views/enterprise/company.vue(公司简介 + 组织架构树)。

type OrgNode = { key: number; title: string; children: OrgNode[] }

// EP el-tag effect="plain"(默认 type=info / danger)色值
const TAG_PLAIN_INFO = { color: '#909399', background: '#fff', borderColor: '#d3d4d6' }
const TAG_PLAIN_DANGER = { color: '#f56c6c', background: '#fff', borderColor: '#fab6b6' }

/** Vue 的 computed orgTree:扁平建树(Map + roots,父不在列表中的当根) */
function buildOrgTree(items: OrgItem[]): OrgNode[] {
  const map = new Map<number, OrgNode>()
  for (const item of items) {
    map.set(item.id, { key: item.id, title: item.org_name, children: [] })
  }
  const roots: OrgNode[] = []
  for (const item of items) {
    const node = map.get(item.id)
    if (!node) continue
    const parent = item.parent_id ? map.get(item.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function EnterpriseCompanyPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [card, setCard] = useState<Record<string, unknown>>({})
  const [orgs, setOrgs] = useState<OrgItem[]>([])

  const orgTree = useMemo(() => buildOrgTree(orgs), [orgs])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [company, orgList] = await Promise.all([fetchCompany(), fetchOrgs()])
        setCard(company)
        setOrgs(orgList)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const business = (card.business as string[]) || []
  const departments = (card.departments as string[]) || []

  return (
    <Spin spinning={loading}>
      <section className="ent-page">
        <header className="ent-head">
          <div>
            <h1>公司简介</h1>
            <p className="hint">
              {String(card.full_name || '')}（{String(card.short_name || '')}）
            </p>
          </div>
          <Button type="primary" onClick={() => navigate('/enterprise')}>
            去对话里问
          </Button>
        </header>

        <article className="intro-hero">
          <p className="intro-body">{String(card.intro || '')}</p>
          <p className="muted">{String(card.transfer || '')}</p>
        </article>

        <div className="info-grid">
          <article className="info-card">
            <small>使命</small>
            <strong>{String(card.mission || '')}</strong>
          </article>
          <article className="info-card">
            <small>价值观</small>
            <strong>{String(card.values || '')}</strong>
          </article>
          <article className="info-card">
            <small>电话</small>
            <strong>{String(card.phone || '')}</strong>
            <p className="muted">{String(card.email || '')}</p>
          </article>
          <article className="info-card">
            <small>地址</small>
            <strong>{String(card.address || '')}</strong>
            <p className="muted">{String(card.site || '')}</p>
          </article>
        </div>

        <div className="chart-row">
          <div className="chart-card">
            <h3>主营业务</h3>
            {business.map((item) => (
              <Tag key={item} className="chip-gap" style={TAG_PLAIN_INFO}>
                {item}
              </Tag>
            ))}
          </div>
          <div className="chart-card">
            <h3>组织架构</h3>
            {orgTree.length ? (
              <Tree blockNode selectable={false} defaultExpandAll treeData={orgTree} />
            ) : (
              departments.map((item) => (
                <Tag key={item} className="chip-gap" style={TAG_PLAIN_DANGER}>
                  {item}
                </Tag>
              ))
            )}
          </div>
        </div>
      </section>
    </Spin>
  )
}
