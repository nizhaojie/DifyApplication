import { useEffect, useState } from 'react'
import { Brain, MessageCircle, RotateCcw, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clearMemory, fetchMemory, type MemoryMessage } from '@/api/enterprise'
import { PageHeader, Panel, StatCard, Button, Empty, showToast, useConfirm } from '@/ui'

export function EnterpriseMemoryPage() {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [memory, setMemory] = useState<{ last_person: string | null; preferred_name: string | null; total: number; messages: MemoryMessage[] }>({ last_person: null, preferred_name: null, total: 0, messages: [] })

  async function load() {
    setLoading(true)
    try { setMemory(await fetchMemory()) } finally { setLoading(false) }
  }

  async function reset() {
    const ok = await confirm({
      title: '清空对话记忆？',
      description: '清空后对话工作台不会再看到刚才的聊天记录，该操作不可撤销。',
      confirmText: '清空',
      tone: 'danger',
    })
    if (!ok) return
    await clearMemory()
    await load()
    showToast('对话记忆已清空')
  }

  useEffect(() => { void load() }, [])
  const asks = memory.messages.filter((item) => item.role === 'user').slice(-3).reverse()

  return <section>
    <PageHeader
      eyebrow={<><Brain size={13} />Memory</>}
      title="对话记忆"
      desc="工作台会记住本轮对话中的人物和最近业务上下文。"
      actions={<>
        <Button variant="secondary" icon={<MessageCircle size={14} />} onClick={() => navigate('/enterprise')}>回对话</Button>
        <Button variant="danger" icon={<Trash2 size={14} />} disabled={!memory.total} onClick={() => void reset()}>清空</Button>
      </>}
    />
    <div className="stack">
      <div className="grid-stats grid-stats--3">
        <StatCard label="对话自称" value={memory.preferred_name || '还没有'} hint="助手记住的称呼" textValue />
        <StatCard label="最近客户" value={memory.last_person || '还没有'} hint="上一轮提到的人物" textValue delay={50} />
        <StatCard label="已记条数" value={loading ? '—' : memory.total} hint="本轮对话累计" delay={100} />
      </div>
      <Panel flush title="最近三问" actions={<RotateCcw size={15} className={loading ? 'spinner' : ''} style={{ color: 'var(--text-4)' }} />}>
        <div style={{ padding: '4px 20px 16px' }}>
          <div className="memory-list">
            {asks.length ? (
              <ol>
                {asks.map((item, index) => (
                  <li key={`${item.create_time}-${index}`}>
                    <time>{item.create_time || '—'}</time>
                    <p>{item.content}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty
                icon={<Brain size={19} />}
                title="还没有记忆"
                desc="去对话工作台说一句，工作台就会记住上下文。"
                action={<Button variant="secondary" size="sm" onClick={() => navigate('/enterprise')}>开始对话</Button>}
              />
            )}
          </div>
        </div>
      </Panel>
    </div>
  </section>
}
