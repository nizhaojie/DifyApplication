import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, ChevronDown, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchGuideCatalog } from '@/api/enterprise'
import { MarkdownText } from '@/components/MarkdownText'
import { PageHeader, Panel, Button, Empty, Skeleton } from '@/ui'

export function EnterpriseGuidePage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<{ title: string; excerpt: string; content?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    void fetchGuideCatalog()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  return <section>
    <PageHeader
      eyebrow={<><BookOpen size={13} />Onboarding</>}
      title="新人指南"
      desc="入职办公、IT 和日常工作流程，都可以在这里找到答案。"
      actions={<Button variant="secondary" icon={<ArrowRight size={14} />} onClick={() => navigate('/enterprise')}>去对话里问</Button>}
    />
    <Panel flush>
      {loading ? (
        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} height={15} width={`${58 - index * 6}%`} />)}
        </div>
      ) : (
        <div className="accordion">
          {items.map((item, index) => {
            const expanded = open === item.title
            return (
              <article className={`acc-item${expanded ? ' open' : ''}`} key={item.title}>
                <button className="acc-trigger" onClick={() => setOpen(expanded ? null : item.title)} aria-expanded={expanded}>
                  <span className="acc-num">{String(index + 1).padStart(2, '0')}</span>
                  {item.title}
                  <ChevronDown size={16} />
                </button>
                {expanded && (
                  <div className="acc-content">
                    <MarkdownText text={item.content || item.excerpt} />
                    <button className="row-link" onClick={() => navigate(`/enterprise?q=${encodeURIComponent(item.title)}`)}>
                      <MessageCircle size={13} />问助手
                    </button>
                  </div>
                )}
              </article>
            )
          })}
          {!items.length && <Empty icon={<BookOpen size={19} />} title="暂无指南内容" desc="指南目录还没有录入，可以先去问助手。" />}
        </div>
      )}
    </Panel>
  </section>
}
