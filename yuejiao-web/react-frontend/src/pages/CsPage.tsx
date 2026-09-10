import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays, CheckCircle2, CircleHelp, Clock3, FileText, LoaderCircle, Zap,
  MessageCircle, Phone, RefreshCw, Search, Send, Sparkles, UserRound, X,
} from 'lucide-react'
import { fetchEvents, fetchFaqs, fetchSessionMessages, recommendCourses, registerEvent, sendCsMessage, type CourseProjectItem, type EventLectureItem, type FaqItem } from '@/api/cs'
import { MarkdownText } from '@/components/MarkdownText'
import { PageHeader, Panel, Button, Drawer, Modal, Field, Input, Empty, Badge, showToast, useConfirm, type BadgeTone } from '@/ui'
import './cs.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
  intent?: string
  intentCode?: string
  tokensUsed?: number
  responseTimeMs?: number
  sources?: string[]
  cardType?: string
  cardContent?: unknown
  pending?: boolean
}
// 快捷问题(带展示标签与完整问法,点击发送 text)——照搬旧版 quickPrompts
const quickPrompts = [
  { label: '🇩🇪 德国双元制适合什么学历？', text: '请问中德双元制职业教育的招生学历要求是什么？初中或中专可以报吗？' },
  { label: '🇸🇬 新加坡专升本读几年？', text: '大专学历去新加坡读专升本需要多长时间？受中留服认证吗？' },
  { label: '📅 近期讲座活动有哪些？', text: '请问近期有什么关于德国双元制或新加坡留学的讲座分享会吗？' },
  { label: '🏦 官方对公缴费银行账户', text: '请问公司简称是什么？缴费的对公银行账户信息是多少？' },
  { label: '🎯 高中毕业新加坡本科推荐', text: '我是高中毕业，想去新加坡读本科，预算25万左右，有什么推荐的项目？' },
  { label: '🛂 德国工作签证政策', text: '请问德国双元制毕业后在德国工作签证和永居申请政策是怎样的？' },
]
// 输入区上方的「猜你想问」标签行——照搬旧版 prompt-pills-row
const guessPrompts = [
  '请问德国双元制每月补贴津贴有多少欧元？',
  '新加坡专升本受中国教育部留学服务中心学历认证吗？',
  '请问公司的对公转账银行账号和开户行是什么？',
  '我想报名近期的留学宣讲会',
  '初中学历可以报德国双元制预科或者国内工学交替班吗？',
]
const guessPromptLabels = ['德国双元制津贴', '中留服学历认证', '对公账户账号', '我要报名宣讲会', '初中学历升学路径']
// 欢迎语与内置引用来源——照搬旧版 defaultWelcomeMessage
const welcome = '您好！我是粤教国际官方智能客服顾问「小粤同学」🎓\n\n我可以为您提供：\n• 🇩🇪 德国中德双元制职业教育（免学费+企业每月实训津贴）\n• 🇸🇬 新加坡定向本硕连读（专升本1~1.5年/本升硕1年，带薪实习）\n• 📜 德国/新加坡最新签证、工作签与永居政策解读\n• 💡 对公银行账号、退费政策及36条官方权威FAQ秒回\n• 🎯 个性化课程推荐与近期讲座一键预约席位\n\n请问您目前的学历背景是什么？或者您对哪个国家/项目最感兴趣呢？'
const welcomeSources = ['企业信息.docx', '中德精英人才共建计划.docx']

/** 意图 → 徽标配色(照搬旧版 getIntentTagType 六色映射,落到 gqk Badge tone) */
function intentTone(intentCode?: string): BadgeTone {
  switch (intentCode) {
    case 'company_inquiry': return 'info'
    case 'business_query': return 'warning'
    case 'policy_query': return 'danger'
    case 'faq': return 'success'
    case 'course_recommend': return 'danger'
    case 'event_register': return 'brand'
    default: return 'info'
  }
}

function timeNow() { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
function makeSession() { return `cs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

export function CsPage() {
  const confirm = useConfirm()
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('cs_session_id') || makeSession())
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', content: welcome, time: timeNow(), intent: '官方顾问欢迎', intentCode: 'casual_chat', sources: welcomeSources }])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  // 旧版用 ref 做发送重入保护(状态更新前连点/回车不会重复发送),React 侧镜像 sending
  const sendingRef = useRef(false)
  const [events, setEvents] = useState<EventLectureItem[]>([])
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [faqOpen, setFaqOpen] = useState(false)
  const [faqSearch, setFaqSearch] = useState('')
  const [eventToRegister, setEventToRegister] = useState<EventLectureItem | null>(null)
  const [registerName, setRegisterName] = useState('')
  const [registerContact, setRegisterContact] = useState('')
  const [registering, setRegistering] = useState(false)
  const [recommendation, setRecommendation] = useState<CourseProjectItem[]>([])
  const [recommending, setRecommending] = useState(false)
  const [recommendForm, setRecommendForm] = useState({ education_level: '', target_country: '', budget_max: '', interest_keyword: '' })
  const [error, setError] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  // 会话 id 持久化
  useEffect(() => { localStorage.setItem('cs_session_id', sessionId) }, [sessionId])
  // 活动与 FAQ 只需加载一次;会话历史只在首次挂载时按已存 id 回放(旧版行为:欢迎语 + 历史追加,不随会话切换重放)
  useEffect(() => {
    void Promise.all([fetchEvents(), fetchFaqs()]).then(([eventList, faqList]) => { setEvents(eventList); setFaqs(faqList) }).catch(() => setError('活动或 FAQ 数据暂时无法加载'))
    const saved = localStorage.getItem('cs_session_id')
    if (saved) {
      void fetchSessionMessages(saved).then((items) => {
        if (items.length) {
          setMessages((prev) => [
            ...prev,
            ...items.map((item, index) => ({
              id: `history-${item.id ?? index}`,
              role: (item.role === 'user' ? 'user' : 'assistant') as ChatMessage['role'],
              content: String(item.content || ''),
              time: String(item.create_time || '').replace('T', ' ').slice(11, 16),
              intent: item.intent ? String(item.intent) : undefined,
              tokensUsed: typeof item.tokens_used === 'number' ? item.tokens_used : undefined,
              responseTimeMs: typeof item.response_time_ms === 'number' ? item.response_time_ms : undefined,
            })),
          ])
        }
      }).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [messages])

  /** 打字机流式渲染(照搬旧版 streamTypewriterText:按长度分档加速,14ms/帧) */
  async function streamTypewriterText(messageId: string, fullText: string) {
    if (!fullText) return
    const chars = Array.from(fullText)
    const step = chars.length > 200 ? 6 : chars.length > 80 ? 3 : 1
    let index = 0
    while (index < chars.length) {
      index = Math.min(index + step, chars.length)
      const content = chars.slice(0, index).join('')
      setMessages((items) => items.map((item) => (item.id === messageId ? { ...item, content } : item)))
      await new Promise((resolve) => setTimeout(resolve, 14))
    }
  }

  async function send(event?: FormEvent, value?: string) {
    event?.preventDefault()
    const content = (value ?? draft).trim()
    if (!content || sendingRef.current) return
    sendingRef.current = true
    setDraft(''); setError(''); setSending(true)
    const assistantId = `assistant-${Date.now()}`
    setMessages((items) => [...items, { id: `user-${Date.now()}`, role: 'user', content, time: timeNow() }, { id: assistantId, role: 'assistant', content: '正在检索知识库…', time: timeNow(), pending: true }])
    try {
      const response = await sendCsMessage({ session_id: sessionId, message: content })
      if (response.session_id && response.session_id !== sessionId) { setSessionId(response.session_id) }
      setMessages((items) => items.map((item) => item.id === assistantId ? { ...item, content: '', pending: false, intent: response.intent_name, intentCode: response.intent_code, tokensUsed: response.tokens_used, responseTimeMs: response.response_time_ms, sources: response.source_references, cardType: response.card_type, cardContent: response.card_content } : item))
      await streamTypewriterText(assistantId, response.reply)
    } catch (cause) {
      setMessages((items) => items.map((item) => item.id === assistantId ? { ...item, content: cause instanceof Error ? cause.message : '服务暂时不可用，请稍后重试。', pending: false, intent: '异常提示' } : item))
      setError('对话发送失败，请确认后端 API 已启动')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  async function resetSession() {
    // 旧版重置前有确认弹窗(破坏性操作),用 gqk ConfirmProvider 等价实现
    const ok = await confirm({ title: '重置当前会话？', description: '确定要重置当前对话记录并开启新会话吗？', confirmText: '确定重置', tone: 'danger' })
    if (!ok) return
    const next = makeSession()
    setSessionId(next)
    setMessages([{ id: 'welcome', role: 'assistant', content: welcome, time: timeNow(), intent: '官方顾问欢迎', intentCode: 'casual_chat', sources: welcomeSources }])
    showToast('已开启全新会话！')
  }

  async function submitRecommendation(event: FormEvent) {
    event.preventDefault(); setRecommending(true); setError('')
    try { const data = await recommendCourses({ education_level: recommendForm.education_level || undefined, target_country: recommendForm.target_country || undefined, budget_max: recommendForm.budget_max ? Number(recommendForm.budget_max) : undefined, interest_keyword: recommendForm.interest_keyword || undefined }); setRecommendation(data.recommended_courses || []) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '课程推荐失败') }
    finally { setRecommending(false) }
  }

  async function submitRegistration(event: FormEvent) {
    event.preventDefault(); if (!eventToRegister || !registerName.trim() || !registerContact.trim()) return
    setRegistering(true); setError('')
    try {
      const data = await registerEvent({ event_id: eventToRegister.id, customer_name: registerName.trim(), contact_info: registerContact.trim() })
      // 报名成功播报文案照搬旧版 handleEventRegistered
      setMessages((items) => [...items, {
        id: `register-${Date.now()}`,
        role: 'assistant',
        content: `🎉 太棒啦！已为您成功预约讲座【${eventToRegister.event_name}】！\n我们的升学规划顾问将提前向您发送参会指南，请保持手机畅通。您还可以继续向我咨询更多项目细节～`,
        time: timeNow(),
        intent: '报名确认',
        intentCode: 'event_register',
        cardType: 'register_success',
        cardContent: data,
      }])
      setEventToRegister(null); setRegisterName(''); setRegisterContact('')
      showToast('预约登记成功')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '活动报名失败') }
    finally { setRegistering(false) }
  }

  const filteredFaqs = useMemo(() => { const query = faqSearch.trim().toLowerCase(); return faqs.filter((item) => !query || `${item.question} ${item.answer} ${item.keywords?.join(' ')}`.toLowerCase().includes(query)) }, [faqs, faqSearch])

  return <section>
    <PageHeader
      eyebrow={<><MessageCircle size={13} />Service Agent</>}
      title="小粤同学"
      desc="面向客户的咨询、知识检索、课程推荐和活动报名工作台。"
      actions={<>
        <Button variant="secondary" icon={<CircleHelp size={14} />} onClick={() => setFaqOpen(true)}>FAQ{faqs.length ? ` · ${faqs.length}` : ''}</Button>
        <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={resetSession}>新会话</Button>
      </>}
    />
    {error && <div className="alert"><CircleHelp size={15} /><span>{error}</span><button onClick={() => setError('')} aria-label="关闭提示"><X size={14} /></button></div>}

    <div className="chat-grid">
      <Panel flush className="chat" title="粤教国际官方顾问" desc="中德双元制 · 新加坡定向升学 · 政策答疑" actions={<span className="live-dot"><i aria-hidden />在线</span>}>
        <div className="quick-prompts">
          {quickPrompts.map((prompt) => <button key={prompt.label} onClick={() => void send(undefined, prompt.text)}>{prompt.label}</button>)}
        </div>
        <div className="chat-log" ref={logRef}>
          {messages.map((message) => (
            <div className={`msg msg--${message.role}`} key={message.id}>
              <div className="msg-avatar">{message.role === 'assistant' ? <Sparkles size={13} /> : <UserRound size={13} />}</div>
              <div className="msg-main">
                <div className="msg-meta">
                  {message.role === 'assistant' ? '小粤同学' : '访客'}
                  {message.intent && (
                    <Badge tone={message.role === 'assistant' ? intentTone(message.intentCode) : 'neutral'}>{message.intent}</Badge>
                  )}
                  {message.role === 'assistant' && message.responseTimeMs ? (
                    <span className="msg-metric"><Zap size={10} />{message.responseTimeMs}ms</span>
                  ) : null}
                  {message.role === 'assistant' && message.tokensUsed ? (
                    <span className="msg-metric">{message.tokensUsed} Tokens</span>
                  ) : null}
                  <time>{message.time}</time>
                </div>
                <div className={`bubble${message.pending ? ' bubble--pending' : ''}`}>
                  {message.pending
                    ? <><LoaderCircle size={14} className="spinner" />{message.content}</>
                    : message.role === 'assistant' ? <MarkdownText text={message.content} /> : message.content}
                </div>
                {message.cardType && <StructuredCard type={message.cardType} content={message.cardContent} onConsult={(name) => void send(undefined, `我想详细了解【${name}】的申请门槛、学制和费用`)} onRegister={(item) => setEventToRegister(item)} />}
                {message.sources?.length ? (
                  <div className="cs-citations">
                    <span className="cs-citations-label"><FileText size={11} />权威依据与参考来源：</span>
                    {message.sources.map((src) => <span className="cs-citation-chip" key={src}>{src}</span>)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="composer">
          <div className="cs-pills-row">
            <span className="cs-pills-label">猜你想问：</span>
            <div className="cs-pills-scroll">
              {guessPrompts.map((prompt, index) => (
                <button key={prompt} className="cs-pill" onClick={() => void send(undefined, prompt)}>{guessPromptLabels[index]}</button>
              ))}
            </div>
          </div>
          <form className="composer-form" onSubmit={(event) => void send(event)}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }}
              rows={3}
              placeholder="输入您关心的升学问题，Enter 发送，Shift + Enter 换行"
              disabled={sending}
            />
            <button className="send-btn" disabled={sending || !draft.trim()} aria-label="发送"><Send size={15} /></button>
          </form>
          <div className="composer-foot">
            <span>会话 {sessionId.slice(-8)}</span>
            <span><Clock3 size={12} />{sending ? '处理中' : '实时服务'}</span>
          </div>
        </div>
      </Panel>

      <div className="side-stack">
        <Panel flush title="近期活动" desc="讲座与线下活动预约">
          <div style={{ padding: '4px 20px 12px' }}>
            <div className="side-list">
              {events.slice(0, 3).map((item) => (
                <article className="side-item" key={item.id}>
                  <div>
                    <strong>{item.event_name}</strong>
                    <span>{new Date(item.start_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {item.location || '线上活动'}</span>
                  </div>
                  <Button size="sm" variant={item.has_available_seats ? 'secondary' : 'ghost'} disabled={!item.has_available_seats} onClick={() => setEventToRegister(item)}>
                    {item.has_available_seats ? '预约' : '已满'}
                  </Button>
                </article>
              ))}
              {!events.length && <Empty tight title="暂无活动" desc="新的讲座或活动发布后会出现在这里。" />}
            </div>
          </div>
        </Panel>

        <Panel flush title="课程推荐" desc="按学历、国家和兴趣匹配">
          <form style={{ padding: '16px 20px 20px', display: 'grid', gap: 9 }} onSubmit={(event) => void submitRecommendation(event)}>
            <select className="select" value={recommendForm.education_level} onChange={(event) => setRecommendForm({ ...recommendForm, education_level: event.target.value })}>
              <option value="">学历不限</option>
              <option>初中</option><option>中专</option><option>高中</option><option>大专</option><option>本科</option>
            </select>
            <select className="select" value={recommendForm.target_country} onChange={(event) => setRecommendForm({ ...recommendForm, target_country: event.target.value })}>
              <option value="">国家不限</option>
              <option>德国</option><option>新加坡</option>
            </select>
            <input className="input" value={recommendForm.interest_keyword} onChange={(event) => setRecommendForm({ ...recommendForm, interest_keyword: event.target.value })} placeholder="兴趣方向，如计算机" />
            <Button type="submit" variant="primary" disabled={recommending} icon={recommending ? <LoaderCircle size={14} className="spinner" /> : <Sparkles size={14} />}>获取推荐</Button>
          </form>
          {recommendation.length ? (
            <div style={{ padding: '0 20px 18px' }}>
              <div className="side-list">
                {recommendation.map((course) => (
                  <article className="side-item" key={course.id}>
                    <div>
                      <strong>{course.project_name}</strong>
                      <span>{course.category || '项目'} · {course.duration || '周期待定'}</span>
                      <p>{course.description || course.target_audience || '适合进一步咨询项目详情。'}</p>
                      <button className="row-link" style={{ marginTop: 7 }} onClick={() => void send(undefined, `我想详细了解【${course.project_name}】`)}>
                        <Phone size={12} />继续咨询
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="side-hint" style={{ padding: '0 20px 18px' }}>选择学历或国家后，可以直接获取课程匹配结果。</p>
          )}
        </Panel>
      </div>
    </div>

    <Drawer open={faqOpen} onClose={() => setFaqOpen(false)} eyebrow="知识库" title="高频问答库" width={520}>
      <label className="search-box" style={{ maxWidth: 'none', marginBottom: 14 }}>
        <Search size={14} />
        <input value={faqSearch} onChange={(event) => setFaqSearch(event.target.value)} placeholder="搜索问题、关键词" />
      </label>
      <div className="side-list">
        {filteredFaqs.map((item) => (
          <button key={item.id} className="side-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setFaqOpen(false); void send(undefined, item.question) }}>
            <div>
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
            </div>
          </button>
        ))}
        {!filteredFaqs.length && <Empty tight title="没有匹配的问题" desc="换个关键词，或直接在对话里提问。" />}
      </div>
    </Drawer>

    <Modal
      open={Boolean(eventToRegister)}
      onClose={() => setEventToRegister(null)}
      title="预约活动"
      desc={eventToRegister?.event_name}
      footer={<>
        <Button variant="ghost" onClick={() => setEventToRegister(null)}>取消</Button>
        <Button variant="primary" disabled={registering} onClick={(event) => void submitRegistration(event as unknown as FormEvent)}>
          {registering ? <LoaderCircle size={14} className="spinner" /> : <CheckCircle2 size={14} />}确认预约
        </Button>
      </>}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="姓名"><Input value={registerName} onChange={(event) => setRegisterName(event.target.value)} required placeholder="请输入报名人姓名" /></Field>
        <Field label="联系方式"><Input value={registerContact} onChange={(event) => setRegisterContact(event.target.value)} required placeholder="手机号或邮箱" /></Field>
      </div>
    </Modal>
  </section>
}

function StructuredCard({ type, content, onConsult, onRegister }: { type: string; content: unknown; onConsult: (name: string) => void; onRegister: (item: EventLectureItem) => void }) {
  const source = content as { courses?: CourseProjectItem[]; events?: EventLectureItem[]; recommended_courses?: CourseProjectItem[] } | CourseProjectItem[] | EventLectureItem[] | undefined
  const list = Array.isArray(source) ? source : type === 'course_list' ? source?.courses || source?.recommended_courses || [] : source?.events || []
  if (type === 'register_success') {
    return (
      <div className="structured structured--success">
        <CheckCircle2 size={16} />
        <div>
          <strong>预约登记成功</strong>
          <span>{String((content as Record<string, unknown>)?.event_name || '活动报名信息已提交')}</span>
        </div>
      </div>
    )
  }
  if (type === 'course_list') {
    return (
      <div className="structured">
        <div className="structured-title"><Sparkles size={13} />为您匹配到以下项目</div>
        {(list as CourseProjectItem[]).map((item) => (
          <button key={item.id} className="structured-item" onClick={() => onConsult(item.project_name)}>
            <strong>{item.project_name}</strong>
            <span>{item.category || '项目'} · {item.duration || '周期待定'}</span>
          </button>
        ))}
      </div>
    )
  }
  if (type === 'event_list') {
    return (
      <div className="structured">
        <div className="structured-title"><CalendarDays size={13} />近期活动</div>
        {(list as EventLectureItem[]).map((item) => (
          <button key={item.id} className="structured-item" onClick={() => onRegister(item)}>
            <strong>{item.event_name}</strong>
            <span>{item.location || '线上'} · {item.has_available_seats ? '可预约' : '名额已满'}</span>
          </button>
        ))}
      </div>
    )
  }
  return null
}
