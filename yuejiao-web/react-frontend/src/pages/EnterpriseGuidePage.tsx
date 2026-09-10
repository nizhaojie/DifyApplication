import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Collapse, Spin } from 'antd'
import { MarkdownText } from '@/components/MarkdownText'
import { fetchGuideCatalog } from '@/api/enterprise'

// 等价迁移自 Vue 版 views/enterprise/guide.vue(新人指南,accordion 手风琴单开)。

type GuideItem = { title: string; excerpt: string; content?: string }

export function EnterpriseGuidePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<GuideItem[]>([])

  function ask(title: string) {
    void navigate(`/enterprise?q=${encodeURIComponent(title)}`)
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        setItems(await fetchGuideCatalog())
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Spin spinning={loading}>
      <section className="ent-page">
        <header className="ent-head">
          <div>
            <h1>新人指南</h1>
            <p className="hint">入职办公、IT、楼层设施。展开看全文，或丢给助手追问。</p>
          </div>
          <Button type="primary" onClick={() => navigate('/enterprise')}>
            去对话里问
          </Button>
        </header>

        <Collapse
          accordion
          expandIconPosition="end"
          items={items.map((item) => ({
            key: item.title,
            label: item.title,
            children: (
              <>
                <MarkdownText text={item.content || item.excerpt} />
                <Button size="small" color="primary" variant="text" onClick={() => ask(item.title)}>
                  问助手
                </Button>
              </>
            ),
          }))}
        />
      </section>
    </Spin>
  )
}
