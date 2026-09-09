import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, CircleHelp, Clock3, FileText, LoaderCircle, MessageCircle, Phone, RefreshCw, Send, Sparkles, UserRound, X } from 'lucide-react'
import { fetchEvents, fetchFaqs, fetchSessionMessages, recommendCourses, registerEvent, sendCsMessage, type CourseProjectItem, type EventLectureItem, type FaqItem } from '@/api/cs'
import { MarkdownText } from '@/components/MarkdownText'

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; time: string; intent?: string; sources?: string[]; cardType?: string; cardContent?: unknown; pending?: boolean }
const quickPrompts = [
  '中德双元制适合什么学历？',
  '新加坡专升本需要读几年？',
  '近期有什么留学讲座？',
  '德国双元制毕业后能留德工作吗？',
]
const welcome = '您好！我是粤教国际官方智能客服顾问「小粤同学」。我可以为您解答中德双元制、新加坡升学、签证政策、课程推荐和近期讲座报名。请问您目前的学历背景是什么，或者对哪个国家/项目最感兴趣？'

function timeNow() { return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
function makeSession() { return `cs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

export function CsPage() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('cs_session_id') || makeSession())
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', content: welcome, time: timeNow(), intent: '官方顾问欢迎' }])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
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

  useEffect(() => {
    localStorage.setItem('cs_session_id', sessionId)
    void Promise.all([fetchEvents(), fetchFaqs()]).then(([eventList, faqList]) => { setEvents(eventList); setFaqs(faqList) }).catch(() => setError('活动或 FAQ 数据暂时无法加载'))
    const saved = localStorage.getItem('cs_session_id')
    if (saved) void fetchSessionMessages(saved).then((items) => { if (items.length) setMessages(items.map((item, index) => ({ id: `history-${index}`, role: item.role === 'user' ? 'user' : 'assistant', content: String(item.content || ''), time: String(item.create_time || '').replace('T', ' ').slice(11, 16), intent: String(item.intent || '') || undefined }))) }).catch(() => undefined)
  }, [sessionId])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [messages])

  async function send(event?: FormEvent, value?: string) {
    event?.preventDefault()
    const content = (value ?? draft).trim()
    if (!content || sending) return
    setDraft(''); setError(''); setSending(true)
    const assistantId = `assistant-${Date.now()}`
    setMessages((items) => [...items, { id: `user-${Date.now()}`, role: 'user', content, time: timeNow() }, { id: assistantId, role: 'assistant', content: '正在检索知识库…', time: timeNow(), pending: true }])
    try {
      const response = await sendCsMessage({ session_id: sessionId, message: content })
      if (response.session_id && response.session_id !== sessionId) { setSessionId(response.session_id); localStorage.setItem('cs_session_id', response.session_id) }
      setMessages((items) => items.map((item) => item.id === assistantId ? { ...item, content: response.reply, pending: false, intent: response.intent_name, sources: response.source_references, cardType: response.card_type, cardContent: response.card_content } : item))
    } catch (cause) {
      setMessages((items) => items.map((item) => item.id === assistantId ? { ...item, content: cause instanceof Error ? cause.message : '服务暂时不可用，请稍后重试。', pending: false, intent: '异常提示' } : item))
      setError('对话发送失败，请确认后端 API 已启动')
    } finally { setSending(false) }
  }

  function resetSession() { const next = makeSession(); localStorage.setItem('cs_session_id', next); setSessionId(next); setMessages([{ id: 'welcome', role: 'assistant', content: welcome, time: timeNow(), intent: '官方顾问欢迎' }]) }

  async function submitRecommendation(event: FormEvent) {
    event.preventDefault(); setRecommending(true); setError('')
    try { const data = await recommendCourses({ education_level: recommendForm.education_level || undefined, target_country: recommendForm.target_country || undefined, budget_max: recommendForm.budget_max ? Number(recommendForm.budget_max) : undefined, interest_keyword: recommendForm.interest_keyword || undefined }); setRecommendation(data.recommended_courses || []) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '课程推荐失败') }
    finally { setRecommending(false) }
  }

  async function submitRegistration(event: FormEvent) {
    event.preventDefault(); if (!eventToRegister || !registerName.trim() || !registerContact.trim()) return
    setRegistering(true); setError('')
    try { const data = await registerEvent({ event_id: eventToRegister.id, customer_name: registerName.trim(), contact_info: registerContact.trim() }); setMessages((items) => [...items, { id: `register-${Date.now()}`, role: 'assistant', content: String(data.message || `已为您登记活动「${eventToRegister.event_name}」`), time: timeNow(), intent: '报名确认', cardType: 'register_success', cardContent: data }]); setEventToRegister(null); setRegisterName(''); setRegisterContact('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '活动报名失败') }
    finally { setRegistering(false) }
  }

  const filteredFaqs = useMemo(() => { const query = faqSearch.trim().toLowerCase(); return faqs.filter((item) => !query || `${item.question} ${item.answer} ${item.keywords?.join(' ')}`.toLowerCase().includes(query)) }, [faqs, faqSearch])
  return <section className="cs-page">
    <header className="page-heading"><div><div className="eyebrow"><MessageCircle size={14} /> CUSTOMER SERVICE AGENT</div><h1>小粤同学</h1><p>面向客户的咨询、知识检索、课程推荐和活动报名工作台。</p></div><div className="heading-actions"><button className="ghost-button" onClick={() => setFaqOpen(true)}><CircleHelp size={15} />FAQ {faqs.length ? `(${faqs.length})` : ''}</button><button className="danger-button" onClick={resetSession}><RefreshCw size={15} />新会话</button></div></header>
    {error && <div className="alert-banner"><CircleHelp size={16} /><span>{error}</span><button onClick={() => setError('')} aria-label="关闭提示"><X size={15} /></button></div>}
    <div className="cs-grid">
      <section className="panel-surface cs-chat-panel"><div className="cs-chat-header"><div className="cs-avatar"><Sparkles size={18} /></div><div><h2>粤教国际官方顾问</h2><p>中德双元制 · 新加坡定向升学 · 政策答疑</p></div><span className="live-dot">在线</span></div><div className="cs-quick-prompts">{quickPrompts.map((prompt) => <button key={prompt} onClick={() => void send(undefined, prompt)}>{prompt}</button>)}</div><div className="cs-message-list" ref={logRef}>{messages.map((message) => <div className={`cs-message ${message.role}`} key={message.id}><div className="cs-message-avatar">{message.role === 'assistant' ? <Sparkles size={14} /> : <UserRound size={14} />}</div><div className="cs-message-main"><div className="cs-message-meta"><span>{message.role === 'assistant' ? '小粤同学' : '访客'}</span>{message.intent && <em>{message.intent}</em>}<time>{message.time}</time></div><div className={`cs-bubble ${message.pending ? 'pending' : ''}`}>{message.pending ? <><LoaderCircle size={15} className="spin" />{message.content}</> : message.role === 'assistant' ? <MarkdownText text={message.content} /> : message.content}</div>{message.cardType && <StructuredCard type={message.cardType} content={message.cardContent} onConsult={(name) => void send(undefined, `我想详细了解【${name}】的申请门槛、学制和费用`)} onRegister={(item) => setEventToRegister(item)} />}{message.sources?.length ? <div className="cs-sources"><FileText size={12} />{message.sources.join(' · ')}</div> : null}</div></div>)}</div><div className="cs-composer"><form onSubmit={(event) => void send(event)}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} rows={3} placeholder="输入您关心的升学问题，Enter 发送，Shift + Enter 换行" disabled={sending} /><button className="send-button" disabled={sending || !draft.trim()} aria-label="发送"><Send size={17} /></button></form><small><Clock3 size={12} /> 会话 {sessionId.slice(-8)} · {sending ? '处理中' : '实时服务'}</small></div></section>
      <aside className="cs-side-column"><section className="panel-surface cs-side-card"><div className="section-title"><div><div className="eyebrow">UPCOMING EVENTS</div><h2>近期活动</h2></div><CalendarDays size={17} /></div>{events.slice(0, 3).map((item) => <article className="event-item" key={item.id}><div><strong>{item.event_name}</strong><span>{new Date(item.start_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {item.location || '线上活动'}</span></div><button className="small-button success" disabled={!item.has_available_seats} onClick={() => setEventToRegister(item)}>{item.has_available_seats ? '预约' : '已满'}</button></article>)}{!events.length && <div className="empty-inline">暂无活动</div>}</section><section className="panel-surface cs-side-card"><div className="section-title"><div><div className="eyebrow">COURSE MATCH</div><h2>课程推荐</h2></div><Sparkles size={17} /></div><form className="recommend-form" onSubmit={(event) => void submitRecommendation(event)}><select value={recommendForm.education_level} onChange={(event) => setRecommendForm({ ...recommendForm, education_level: event.target.value })}><option value="">学历不限</option><option>初中</option><option>中专</option><option>高中</option><option>大专</option><option>本科</option></select><select value={recommendForm.target_country} onChange={(event) => setRecommendForm({ ...recommendForm, target_country: event.target.value })}><option value="">国家不限</option><option>德国</option><option>新加坡</option></select><input value={recommendForm.interest_keyword} onChange={(event) => setRecommendForm({ ...recommendForm, interest_keyword: event.target.value })} placeholder="兴趣方向，如计算机" /><button className="primary-button" disabled={recommending}>{recommending ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}获取推荐</button></form>{recommendation.map((course) => <article className="course-item" key={course.id}><strong>{course.project_name}</strong><span>{course.category || '项目'} · {course.duration || '周期待定'}</span><p>{course.description || course.target_audience || '适合进一步咨询项目详情。'}</p><button className="text-button" onClick={() => void send(undefined, `我想详细了解【${course.project_name}】`)}>继续咨询 <Phone size={13} /></button></article>)}{!recommendation.length && <p className="side-hint">选择学历或国家后，可以直接获取课程匹配结果。</p>}</section></aside>
    </div>
    {faqOpen && <div className="drawer-backdrop" onClick={() => setFaqOpen(false)}><aside className="detail-drawer faq-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">KNOWLEDGE BASE</span><h2>高频问答库</h2></div><button className="icon-button" onClick={() => setFaqOpen(false)} aria-label="关闭"><X size={18} /></button></div><label className="faq-search"><CircleHelp size={15} /><input value={faqSearch} onChange={(event) => setFaqSearch(event.target.value)} placeholder="搜索问题、关键词" /></label><div className="faq-list">{filteredFaqs.map((item) => <button key={item.id} onClick={() => { setFaqOpen(false); void send(undefined, item.question) }}><strong>{item.question}</strong><span>{item.answer}</span></button>)}{!filteredFaqs.length && <div className="empty-inline">没有匹配的问题</div>}</div></aside></div>}
    {eventToRegister && <div className="modal-backdrop" onClick={() => setEventToRegister(null)}><form className="modal-card" onSubmit={(event) => void submitRegistration(event)} onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">EVENT REGISTRATION</span><h2>预约活动</h2></div><button type="button" className="icon-button" onClick={() => setEventToRegister(null)} aria-label="关闭"><X size={18} /></button></div><p className="modal-event-name">{eventToRegister.event_name}</p><label className="field-label">姓名<input value={registerName} onChange={(event) => setRegisterName(event.target.value)} required placeholder="请输入报名人姓名" /></label><label className="field-label">联系方式<input value={registerContact} onChange={(event) => setRegisterContact(event.target.value)} required placeholder="手机号或邮箱" /></label><button className="primary-button modal-submit" disabled={registering}>{registering ? <LoaderCircle size={15} className="spin" /> : <CheckCircle2 size={15} />}确认预约</button></form></div>}
  </section>
}

function StructuredCard({ type, content, onConsult, onRegister }: { type: string; content: unknown; onConsult: (name: string) => void; onRegister: (item: EventLectureItem) => void }) {
  const source = content as { courses?: CourseProjectItem[]; events?: EventLectureItem[]; recommended_courses?: CourseProjectItem[] } | CourseProjectItem[] | EventLectureItem[] | undefined
  const list = Array.isArray(source) ? source : type === 'course_list' ? source?.courses || source?.recommended_courses || [] : source?.events || []
  if (type === 'register_success') return <div className="structured-card register-card"><CheckCircle2 size={18} /><strong>预约登记成功</strong><span>{String((content as Record<string, unknown>)?.event_name || '活动报名信息已提交')}</span></div>
  if (type === 'course_list') return <div className="structured-card"><div className="structured-title"><Sparkles size={14} />为您匹配到以下项目</div>{(list as CourseProjectItem[]).map((item) => <button key={item.id} className="structured-item" onClick={() => onConsult(item.project_name)}><strong>{item.project_name}</strong><span>{item.category || '项目'} · {item.duration || '周期待定'}</span></button>)}</div>
  if (type === 'event_list') return <div className="structured-card"><div className="structured-title"><CalendarDays size={14} />近期活动</div>{(list as EventLectureItem[]).map((item) => <button key={item.id} className="structured-item" onClick={() => onRegister(item)}><strong>{item.event_name}</strong><span>{item.location || '线上'} · {item.has_available_seats ? '可预约' : '名额已满'}</span></button>)}</div>
  return null
}
