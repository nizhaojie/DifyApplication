import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Spin } from 'antd'
import { clearMemory, fetchMemory, type MemoryMessage } from '@/api/enterprise'
import { confirmBox, toast } from '@/components/feedback'

// 等价迁移自 Vue 版 views/enterprise/memory.vue(对话记忆:3 统计卡 + 最近三问 + 清空)。

export function EnterpriseMemoryPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [lastPerson, setLastPerson] = useState<string | null>(null)
  const [preferredName, setPreferredName] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [messages, setMessages] = useState<MemoryMessage[]>([])

  const recentAsks = messages.filter((item) => item.role === 'user').slice(-3).reverse()

  async function load() {
    setLoading(true)
    try {
      const data = await fetchMemory()
      setLastPerson(data.last_person)
      setPreferredName(data.preferred_name)
      setTotal(data.total)
      setMessages(data.messages || [])
    } finally {
      setLoading(false)
    }
  }

  async function reset() {
    const ok = await confirmBox({ title: '开始新对话', content: '清空后对话工作台不会再看到刚才的聊天。' })
    if (!ok) return
    await clearMemory()
    toast.success('已清空')
    await load()
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Spin spinning={loading}>
      <section className="ent-page">
        <header className="ent-head">
          <div>
            <h1>对话记忆</h1>
            <p className="hint">会记住这轮对话里你说过的自称、最近客户。完整对话在工作台，刷新也不会丢。</p>
          </div>
          <div className="head-actions">
            <Button onClick={() => navigate('/enterprise')}>回对话</Button>
            <Button color="danger" variant="outlined" disabled={!total} onClick={() => void reset()}>
              清空记忆
            </Button>
          </div>
        </header>

        <div className="stat-row compact">
          <article className="stat-card">
            <small>对话自称</small>
            <strong>{preferredName || '还没有'}</strong>
          </article>
          <article className="stat-card">
            <small>最近客户</small>
            <strong>{lastPerson || '还没有'}</strong>
          </article>
          <article className="stat-card">
            <small>已记条数</small>
            <strong>{total}</strong>
          </article>
        </div>

        <div className="chart-card">
          <h3>最近三问</h3>
          {recentAsks.length ? (
            <ol className="ask-list">
              {recentAsks.map((item, index) => (
                <li key={index}>
                  <small>{item.create_time}</small>
                  <p>{item.content}</p>
                </li>
              ))}
            </ol>
          ) : (
            <Empty description="还没有记忆。去对话工作台说一句就会记下来。" />
          )}
        </div>
      </section>
    </Spin>
  )
}
