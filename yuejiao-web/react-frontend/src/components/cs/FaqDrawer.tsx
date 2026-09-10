import { useEffect, useMemo, useState } from 'react'
import { Button, Collapse, Drawer, Input, Spin } from 'antd'
import { ChatDotRound, Search } from '@/components/elementIcons'
import { csApi } from '@/api/cs'
import { EpTag } from './EpTag'
import type { FaqItem } from '@/api/csTypes'
import './FaqDrawer.css'

const categories = [
  '全部',
  '企业概况与合作背景',
  '德国双元制核心政策',
  '赴德双元制项目详情',
  '新加坡/海外交流项目',
  '国内研学与职业素养培训',
  '报名与咨询流程',
]

/** 等价迁移自 Vue 版 views/cs/components/FaqDrawer.vue */
export function FaqDrawer({
  open,
  onClose,
  onSelectQuestion,
}: {
  open: boolean
  onClose: () => void
  onSelectQuestion: (question: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [faqs, setFaqs] = useState<FaqItem[]>([])

  // Vue 的 onMounted:组件随页面挂载即拉取全部 FAQ,失败静默
  useEffect(() => {
    void loadFaqs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFaqs() {
    setLoading(true)
    try {
      const list = await csApi.getFaqs()
      if (list && list.length) {
        setFaqs(list)
      }
    } catch (err) {
      console.error('Failed to load faqs:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredFaqs = useMemo(() => {
    let list = faqs

    if (selectedCategory !== '全部') {
      list = list.filter((item) => item.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q) ||
          item.keywords?.some((k) => k.toLowerCase().includes(q)),
      )
    }

    return list
  }, [faqs, searchQuery, selectedCategory])

  function handleAsk(question: string) {
    onSelectQuestion(question)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="常见咨询问题库 (36条标准FAQ)"
      width={520}
      placement="right"
      destroyOnHidden
      className="faq-drawer"
    >
      <div className="faq-container">
        {/* 搜索栏 */}
        <div className="faq-search-wrap">
          <Input
            value={searchQuery}
            placeholder="搜索政策、专业、费用、签证等关键词..."
            allowClear
            prefix={<Search size={14} style={{ color: '#c0c4cc' }} />}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 分类标签切换 */}
        <div className="category-tabs">
          {categories.map((cat) => (
            <EpTag
              key={cat}
              type={selectedCategory === cat ? 'danger' : 'info'}
              effect={selectedCategory === cat ? 'dark' : 'plain'}
              className="cat-chip"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </EpTag>
          ))}
        </div>

        {/* 问答列表(v-loading → Spin) */}
        <div className="faq-list">
          <Spin spinning={loading}>
            {filteredFaqs.length === 0 ? (
              <div className="empty-faq">
                未检索到相关常见问题，您可直接在聊天窗口向客服提问。
              </div>
            ) : (
              <Collapse
                accordion
                className="faq-collapse"
                items={filteredFaqs.map((item, idx) => ({
                  key: String(item.id || idx),
                  label: (
                    <div className="faq-question-title">
                      <span className="faq-idx">{idx + 1}.</span>
                      <span className="faq-q-text">{item.question}</span>
                    </div>
                  ),
                  children: (
                    <div className="faq-answer-wrap">
                      <div className="faq-answer-text">{item.answer}</div>
                      <div className="faq-action-row">
                        {/* Vue 为 el-button type="primary" link(链接态按钮) */}
                        <Button
                          type="link"
                          size="small"
                          className="ask-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAsk(item.question)
                          }}
                        >
                          <ChatDotRound size={12} />
                          发送至聊天框详细咨询
                        </Button>
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Spin>
        </div>
      </div>
    </Drawer>
  )
}
