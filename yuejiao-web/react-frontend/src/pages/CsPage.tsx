import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Avatar, Button, Input, Select } from 'antd'
import {
  Calendar,
  CircleCheckFilled,
  Delete,
  Document,
  Lightning,
  MagicStick,
  Promotion,
  Service,
  User,
} from '@/components/elementIcons'
import { confirmBox, toast } from '@/components/feedback'
import { csApi } from '@/api/cs'
import type { ChatMessageItem, CourseProjectItem, EventLectureItem, UIConversationMessage } from '@/api/csTypes'
import { CitationBadge } from '@/components/cs/CitationBadge'
import { CourseCard } from '@/components/cs/CourseCard'
import { EventCard } from '@/components/cs/EventCard'
import { FaqDrawer } from '@/components/cs/FaqDrawer'
import { EpTag } from '@/components/cs/EpTag'
import type { EpTagType } from '@/components/cs/EpTag'
import './CsPage.css'

function getCurrentTimeStr(): string {
  const d = new Date()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${mins}`
}

// Welcome Message
const defaultWelcomeMessage: UIConversationMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content:
    '您好！我是粤教国际官方智能客服顾问「小粤同学」🎓\n\n我可以为您提供：\n• 🇩🇪 德国中德双元制职业教育（免学费+企业每月实训津贴）\n• 🇸🇬 新加坡定向本硕连读（专升本1~1.5年/本升硕1年，带薪实习）\n• 📜 德国/新加坡最新签证、工作签与永居政策解读\n• 💡 对公银行账号、退费政策及36条官方权威FAQ秒回\n• 🎯 个性化课程推荐与近期讲座一键预约席位\n\n请问您目前的学历背景是什么？或者您对哪个国家/项目最感兴趣呢？',
  time: getCurrentTimeStr(),
  intent_name: '官方顾问欢迎',
  intent_code: 'casual_chat',
  tokens_used: 92,
  response_time_ms: 15,
  source_references: ['企业信息.docx', '中德精英人才共建计划.docx'],
}

// Quick Prompt Chips
const quickPrompts = [
  { label: '🇩🇪 德国双元制适合什么学历？', text: '请问中德双元制职业教育的招生学历要求是什么？初中或中专可以报吗？' },
  { label: '🇸🇬 新加坡专升本读几年？', text: '大专学历去新加坡读专升本需要多长时间？受中留服认证吗？' },
  { label: '📅 近期讲座活动有哪些？', text: '请问近期有什么关于德国双元制或新加坡留学的讲座分享会吗？' },
  { label: '🏦 官方对公缴费银行账户', text: '请问公司简称是什么？缴费的对公银行账户信息是多少？' },
  { label: '🎯 高中毕业新加坡本科推荐', text: '我是高中毕业，想去新加坡读本科，预算25万左右，有什么推荐的项目？' },
  { label: '🛂 德国工作签证政策', text: '请问德国双元制毕业后在德国工作签证和永居申请政策是怎样的？' },
]

function makeSessionId(): string {
  return `cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
}

export function CsPage() {
  // Session State
  const [sessionId, setSessionId] = useState('')
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [faqDrawerVisible, setFaqDrawerVisible] = useState(false)
  const [messages, setMessages] = useState<UIConversationMessage[]>([])
  const messageListRef = useRef<HTMLDivElement>(null)
  // Vue 用 ref 做重入保护(始终读到最新值),React 侧用 ref 镜像 isSending
  const isSendingRef = useRef(false)

  // 超集区块(React 版遗留,Vue 无):近期活动侧栏 + 课程推荐表单
  const [events, setEvents] = useState<EventLectureItem[]>([])
  const [recommendation, setRecommendation] = useState<CourseProjectItem[]>([])
  const [recommending, setRecommending] = useState(false)
  const [recommendForm, setRecommendForm] = useState({
    education_level: '',
    target_country: '',
    budget_max: '',
    interest_keyword: '',
  })

  useEffect(() => {
    initSession()

    // ---- 以下为超集区块(Vue 基准没有):侧栏活动 + 会话历史回放 ----
    void csApi
      .getEvents()
      .then((list) => setEvents(list || []))
      .catch(() => undefined)

    const saved = localStorage.getItem('cs_session_id')
    if (saved) {
      void csApi
        .getSessionMessages(saved)
        .then((items) => {
          if (items.length) {
            // TODO(迁移): 超集行为——把已存会话回放到欢迎语之后(Vue 只展示欢迎语)
            setMessages((prev) => [
              ...prev,
              ...items.map((item, index) => mapHistoryMessage(item, index)),
            ])
          }
        })
        .catch(() => undefined)
    }
    // ---- 超集区块结束 ----
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function initSession() {
    const savedId = localStorage.getItem('cs_session_id')
    let nextId: string
    if (savedId) {
      nextId = savedId
    } else {
      nextId = makeSessionId()
      localStorage.setItem('cs_session_id', nextId)
    }
    setSessionId(nextId)

    setMessages([{ ...defaultWelcomeMessage, time: getCurrentTimeStr() }])
    scrollToBottom()
  }

  function scrollToBottom() {
    // 等价 Vue 的 nextTick:等本轮 DOM 更新完成后再滚底
    window.setTimeout(() => {
      const el = messageListRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    }, 0)
  }

  async function streamTypewriterText(messageId: string, fullText: string) {
    if (!fullText) return
    const chars = Array.from(fullText)
    const step = chars.length > 200 ? 6 : chars.length > 80 ? 3 : 1
    let index = 0

    while (index < chars.length) {
      index = Math.min(index + step, chars.length)
      const content = chars.slice(0, index).join('')
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content } : m)))
      scrollToBottom()
      await new Promise((resolve) => setTimeout(resolve, 14))
    }
  }

  async function handleSend(textToSend?: string) {
    const content = (textToSend || inputMessage).trim()
    if (!content) return
    if (isSendingRef.current) return

    // 1. Append user message
    const userMsg: UIConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      time: getCurrentTimeStr(),
    }
    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) {
      setInputMessage('')
    }
    scrollToBottom()

    // 2. Append assistant placeholder
    const assistantMsgId = `assistant-${Date.now()}`
    const assistantMsg: UIConversationMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      time: getCurrentTimeStr(),
      loading: true,
    }
    setMessages((prev) => [...prev, assistantMsg])
    scrollToBottom()

    isSendingRef.current = true
    setIsSending(true)

    try {
      const res = await csApi.sendMessage({
        session_id: sessionId,
        message: content,
      })

      if (res.session_id) {
        setSessionId(res.session_id)
        localStorage.setItem('cs_session_id', res.session_id)
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                loading: false,
                intent_code: res.intent_code,
                intent_name: res.intent_name,
                source_references: res.source_references,
                card_type: res.card_type,
                card_content: res.card_content,
                tokens_used: res.tokens_used,
                response_time_ms: res.response_time_ms,
              }
            : m,
        ),
      )

      // Smooth typewriter rendering
      await streamTypewriterText(assistantMsgId, res.reply)
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                loading: false,
                content: `抱歉，服务连接异常（${err?.message || '请确认后端服务已就绪'}）。您可稍后重试，或点击右上角查看常见问答库。`,
                intent_name: '异常提示',
                intent_code: 'casual_chat',
              }
            : m,
        ),
      )
      toast.error('对话发送失败，请确认后端 API 正常工作')
    } finally {
      isSendingRef.current = false
      setIsSending(false)
      scrollToBottom()
    }
  }

  // TODO(迁移): Vue 原版 handleKeyDown 无 IME isComposing 守卫,按基准照搬(输入法确认回车会直接发送)
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleSelectFaqQuestion(q: string) {
    void handleSend(q)
  }

  function handleCourseConsult(courseName: string) {
    void handleSend(`我想详细了解【${courseName}】的申请门槛、实训补贴与学制周期`)
  }

  function handleEventRegistered(eventName: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `event-ack-${Date.now()}`,
        role: 'assistant',
        content: `🎉 太棒啦！已为您成功预约讲座【${eventName}】！\n我们的升学规划顾问将提前向您发送参会指南，请保持手机畅通。您还可以继续向我咨询更多项目细节～`,
        time: getCurrentTimeStr(),
        intent_name: '报名确认',
        intent_code: 'event_register',
        tokens_used: 48,
        response_time_ms: 10,
      },
    ])
    scrollToBottom()
  }

  async function handleResetSession() {
    const confirmed = await confirmBox({
      title: '提示',
      content: '确定要重置当前对话记录并开启新会话吗？',
      okText: '确定重置',
      cancelText: '取消',
    })
    if (!confirmed) return

    const nextId = makeSessionId()
    setSessionId(nextId)
    localStorage.setItem('cs_session_id', nextId)
    setMessages([{ ...defaultWelcomeMessage, time: getCurrentTimeStr() }])
    toast.success('已开启全新会话！')
  }

  async function submitRecommendation(event: FormEvent) {
    event.preventDefault()
    setRecommending(true)
    try {
      const data = await csApi.getRecommendations({
        education_level: recommendForm.education_level || undefined,
        target_country: recommendForm.target_country || undefined,
        budget_max: recommendForm.budget_max ? Number(recommendForm.budget_max) : undefined,
        interest_keyword: recommendForm.interest_keyword || undefined,
      })
      setRecommendation(data.recommended_courses || [])
    } catch {
      // csApi 内部已 console.error;侧栏推荐失败不打断聊天主流程
    } finally {
      setRecommending(false)
    }
  }

  return (
    <div className="cs-container">
      <div className="cs-main-row">
        {/* 主界面卡片 */}
        <div className="chat-card">
          {/* 顶部状态与功能栏 */}
          <div className="chat-header">
            <div className="header-left">
              <div className="avatar-wrap">
                <Avatar size={42} className="cs-avatar">
                  <Service size={24} />
                </Avatar>
                <span className="status-dot" title="顾问在线中" />
              </div>
              <div className="cs-info">
                <div className="name-row">
                  <span className="cs-name">小粤同学</span>
                  <EpTag effect="dark" className="brand-tag">
                    粤教国际官方
                  </EpTag>
                  <EpTag type="success" effect="plain" className="online-tag">
                    AI 顾问在线
                  </EpTag>
                </div>
                <div className="cs-subtitle">中德双元制 · 新加坡定向升学 · 权威留学政策答疑</div>
              </div>
            </div>

            <div className="header-actions">
              <Button
                type="primary"
                size="small"
                className="faq-btn"
                onClick={() => setFaqDrawerVisible(true)}
              >
                <Document size={12} />
                <span>高频问答库 (36条)</span>
              </Button>

              <Button
                size="small"
                color="danger"
                variant="outlined"
                className="reset-btn"
                title="开启新会话"
                onClick={() => void handleResetSession()}
              >
                <Delete size={12} />
                <span>清空会话</span>
              </Button>
            </div>
          </div>

          {/* 消息列表滚动视窗 */}
          <div ref={messageListRef} className="chat-body">
            {/* 欢迎向导卡片 */}
            <div className="welcome-guide-panel">
              <div className="guide-title">
                <span>✨ 您可以向小粤同学咨询以下热门方向：</span>
              </div>
              <div className="quick-chip-grid">
                {quickPrompts.map((chip) => (
                  <div
                    key={chip.label}
                    className="quick-chip"
                    onClick={() => void handleSend(chip.text)}
                  >
                    {chip.label}
                  </div>
                ))}
              </div>
            </div>

            {/* 消息气泡列表 */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={[
                  'message-row',
                  msg.role === 'user' ? 'is-user' : '',
                  msg.role === 'assistant' ? 'is-assistant' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* 客服头像 */}
                {msg.role === 'assistant' ? (
                  <div className="msg-avatar assistant-avatar">
                    <Service size={18} />
                  </div>
                ) : null}

                {/* 消息实体 */}
                <div className="msg-bubble-wrap">
                  {/* 助手意图与指标头部 */}
                  {msg.role === 'assistant' ? (
                    <div className="assistant-meta-bar">
                      {msg.intent_name ? (
                        <EpTag
                          type={getIntentTagType(msg.intent_code)}
                          effect="plain"
                          className="intent-badge"
                        >
                          {msg.intent_name}
                        </EpTag>
                      ) : null}
                      {msg.response_time_ms ? (
                        <span className="metric-text">
                          <Lightning size={11} />
                          {msg.response_time_ms}ms
                        </span>
                      ) : null}
                      {msg.tokens_used ? (
                        <span className="metric-text">{msg.tokens_used} Tokens</span>
                      ) : null}
                      <span className="msg-time">{msg.time}</span>
                    </div>
                  ) : (
                    <div className="user-meta-bar">
                      <span className="msg-time">{msg.time}</span>
                    </div>
                  )}

                  {/* 消息气泡正文 */}
                  <div className="msg-bubble">
                    {/* 加载中动画 */}
                    {msg.loading ? (
                      <div className="typing-indicator">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                        <span className="typing-hint">小粤正在检索知识库思考中...</span>
                      </div>
                    ) : (
                      <div className="msg-content">{msg.content}</div>
                    )}

                    {/* 结构化卡片渲染：课程推荐列表 */}
                    {/* TODO(迁移): Vue 模板只读 msg.card_content.recommended_courses,而实测后端把
                        card_content 直接返回成课程数组(2026-09-09 实测 /api/v1/cs/chat),
                        Vue 原版因此只渲染标题、卡片永不出现。此处按同型数组兜底以让卡片真正渲染,
                        若要严格逐字对齐 Vue,请去掉 unwrapCardList 兜底 */}
                    {msg.card_type === 'course_list' && msg.card_content ? (
                      <div className="card-container">
                        <div className="card-section-title">
                          <CircleCheckFilled size={13} />
                          <span>为您精准匹配到以下优质课程项目：</span>
                        </div>
                        {(unwrapCardList(msg.card_content, 'recommended_courses') as CourseProjectItem[]).map(
                          (course) => (
                            <CourseCard key={course.id} course={course} onConsult={handleCourseConsult} />
                          ),
                        )}
                      </div>
                    ) : null}

                    {/* 结构化卡片渲染：讲座活动列表 */}
                    {/* TODO(迁移): 同上,Vue 模板只读 msg.card_content.events,实测 card_content 是裸数组
                        (card_type=event_list、card_content=[{...}]),Vue 原版只渲染
                        「近期讲座与招生分享会推荐：」标题;此处按同型数组兜底让 EventCard 真正渲染 */}
                    {msg.card_type === 'event_list' && msg.card_content ? (
                      <div className="card-container">
                        <div className="card-section-title">
                          <CircleCheckFilled size={13} />
                          <span>近期讲座与招生分享会推荐：</span>
                        </div>
                        {(unwrapCardList(msg.card_content, 'events') as EventLectureItem[]).map((evt) => (
                          <EventCard key={evt.id} event={evt} onRegistered={handleEventRegistered} />
                        ))}
                      </div>
                    ) : null}

                    {/* 结构化卡片渲染：报名成功卡片 */}
                    {msg.card_type === 'register_success' && msg.card_content ? (
                      <div className="register-success-card">
                        <div className="success-header">
                          <CircleCheckFilled className="success-icon" size={18} />
                          <span className="success-title">预约登记成功！</span>
                        </div>
                        <div className="success-detail">
                          <div>
                            <strong>活动名称：</strong>
                            {msg.card_content.event_name}
                          </div>
                          <div>
                            <strong>报名编号：</strong>#REG-{msg.card_content.registration_id}
                          </div>
                          <div className="success-notice">
                            讲座开场前顾问老师将通过电话/短信发送入场会议号及校区导航。
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* 知识库来源引用 */}
                    {msg.source_references && msg.source_references.length > 0 ? (
                      <div className="citations-wrapper">
                        <div className="citation-label">权威依据与参考来源：</div>
                        {msg.source_references.map((src) => (
                          <CitationBadge key={src} source={src} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 用户头像 */}
                {msg.role === 'user' ? (
                  <div className="msg-avatar user-avatar">
                    <User size={18} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* 底部输入操作区 */}
          <div className="chat-footer">
            {/* 快捷问答提示标签行 */}
            <div className="prompt-pills-row">
              <span className="pills-label">猜你想问：</span>
              <div className="pills-scroll">
                <EpTag className="prompt-pill" onClick={() => void handleSend('请问德国双元制每月补贴津贴有多少欧元？')}>
                  德国双元制津贴
                </EpTag>
                <EpTag
                  className="prompt-pill"
                  onClick={() => void handleSend('新加坡专升本受中国教育部留学服务中心学历认证吗？')}
                >
                  中留服学历认证
                </EpTag>
                <EpTag className="prompt-pill" onClick={() => void handleSend('请问公司的对公转账银行账号和开户行是什么？')}>
                  对公账户账号
                </EpTag>
                <EpTag className="prompt-pill" onClick={() => void handleSend('我想报名近期的留学宣讲会')}>
                  我要报名宣讲会
                </EpTag>
                <EpTag
                  className="prompt-pill"
                  onClick={() => void handleSend('初中学历可以报德国双元制预科或者国内工学交替班吗？')}
                >
                  初中学历升学路径
                </EpTag>
              </div>
            </div>

            {/* 输入文本框与发送按钮 */}
            <div className="input-area-wrap">
              <Input.TextArea
                value={inputMessage}
                rows={3}
                placeholder="输入您关心的升学问题，或咨询中德双元制与近期讲座... (Enter 发送，Shift+Enter 换行)"
                className="chat-textarea"
                disabled={isSending}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="send-action-bar">
                <span className="input-hint">Enter 发送 / Shift+Enter 换行</span>
                <Button
                  type="primary"
                  className="send-btn"
                  loading={isSending}
                  disabled={!inputMessage.trim() || isSending}
                  onClick={() => void handleSend()}
                >
                  <Promotion size={12} />
                  <span>发送咨询</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ---- 超集附加栏(Vue 基准没有,React 版遗留功能,保持 fetch 调用照旧) ---- */}
        <aside className="cs-side-column">
          <section className="table-card cs-side-card">
            <div className="side-card-head">
              <span className="side-card-title">近期活动</span>
              <Calendar size={16} />
            </div>
            {events.slice(0, 3).map((item) => (
              <EventCard key={item.id} event={item} onRegistered={handleEventRegistered} />
            ))}
            {!events.length ? <div className="side-empty">暂无活动</div> : null}
          </section>

          <section className="table-card cs-side-card">
            <div className="side-card-head">
              <span className="side-card-title">课程推荐</span>
              <MagicStick size={16} />
            </div>
            <form className="recommend-form" onSubmit={(event) => void submitRecommendation(event)}>
              <Select
                value={recommendForm.education_level}
                onChange={(value) => setRecommendForm({ ...recommendForm, education_level: value })}
                options={[
                  { value: '', label: '学历不限' },
                  { value: '初中', label: '初中' },
                  { value: '中专', label: '中专' },
                  { value: '高中', label: '高中' },
                  { value: '大专', label: '大专' },
                  { value: '本科', label: '本科' },
                ]}
              />
              <Select
                value={recommendForm.target_country}
                onChange={(value) => setRecommendForm({ ...recommendForm, target_country: value })}
                options={[
                  { value: '', label: '国家不限' },
                  { value: '德国', label: '德国' },
                  { value: '新加坡', label: '新加坡' },
                ]}
              />
              <Input
                value={recommendForm.interest_keyword}
                onChange={(e) => setRecommendForm({ ...recommendForm, interest_keyword: e.target.value })}
                placeholder="兴趣方向，如计算机"
              />
              <Button type="primary" htmlType="submit" loading={recommending} icon={<MagicStick size={12} />}>
                获取推荐
              </Button>
            </form>
            {recommendation.map((course) => (
              <article className="side-course-item" key={course.id}>
                <strong>{course.project_name}</strong>
                <span>
                  {course.category || '项目'} · {course.duration || '周期待定'}
                </span>
                <p>{course.description || course.target_audience || '适合进一步咨询项目详情。'}</p>
                <Button
                  type="link"
                  size="small"
                  onClick={() => void handleSend(`我想详细了解【${course.project_name}】`)}
                >
                  继续咨询
                </Button>
              </article>
            ))}
            {!recommendation.length ? (
              <p className="side-hint">选择学历或国家后，可以直接获取课程匹配结果。</p>
            ) : null}
          </section>
        </aside>
      </div>

      {/* FAQ 抽屉 */}
      <FaqDrawer
        open={faqDrawerVisible}
        onClose={() => setFaqDrawerVisible(false)}
        onSelectQuestion={handleSelectFaqQuestion}
      />
    </div>
  )
}

/**
 * 等价 Vue 模板的 `msg.card_content.recommended_courses` / `msg.card_content.events` 取值。
 * TODO(迁移): 后端实测会把 card_content 直接给成同型数组(Vue 原版此时一张卡都不渲染),
 * 这里对数组形态做兜底,让课程/讲座卡片真正渲染;严格对齐 Vue 时应去掉兜底。
 */
function unwrapCardList<T = unknown>(content: any, key: 'recommended_courses' | 'events'): T[] {
  if (Array.isArray(content)) return content as T[]
  const list = content?.[key]
  return Array.isArray(list) ? (list as T[]) : []
}

/** 等价 Vue 的 getIntentTagType:意图 → EP tag type 六色映射 */
function getIntentTagType(intentCode?: string): EpTagType {
  switch (intentCode) {
    case 'company_inquiry':
      return 'info'
    case 'business_query':
      return 'warning'
    case 'policy_query':
      return 'danger'
    case 'faq':
      return 'success'
    case 'course_recommend':
      return 'danger'
    case 'event_register':
      return 'primary'
    default:
      return 'info'
  }
}

/** 超集:把后端会话记录映射回 UI 消息(Vue 的 UIConversationMessage 形状) */
function mapHistoryMessage(item: ChatMessageItem, index: number): UIConversationMessage {
  return {
    id: `history-${item.id ?? index}`,
    role: item.role === 'user' ? 'user' : 'assistant',
    content: String(item.content || ''),
    time: String(item.create_time || '').replace('T', ' ').slice(11, 16),
    intent_name: item.intent ? String(item.intent) : undefined,
    tokens_used: item.tokens_used,
    response_time_ms: item.response_time_ms,
  }
}
