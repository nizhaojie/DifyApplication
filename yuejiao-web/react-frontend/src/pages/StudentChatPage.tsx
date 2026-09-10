import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Bot, CirclePlus, Send, Trash2 } from 'lucide-react'
import { chatStudent } from '@/api/student'
import { Button } from '@/ui'
import { showToast } from '@/ui/toast'
import './studentChat.css'

type AssistantMode = 'psych' | 'life' | 'program'
type MessageRole = 'assistant' | 'user'

interface ChatMessage {
  id: number
  role: MessageRole
  content: string
  time: string
}

interface ChatSession {
  id: number
  title: string
  updatedAt: string
  conversationId?: string | null
  messages: ChatMessage[]
}

const MODE_CONFIG: Record<AssistantMode, {
  title: string
  subtitle: string
  placeholder: string
  emptyTitle: string
  opening: string
  quickPrompts: string[]
}> = {
  psych: {
    title: '心理关怀助手',
    subtitle: '为当前学生提供支持性回应、情绪陪伴和高风险分流引导。',
    placeholder: '写下当前学生想表达的感受',
    emptyTitle: '新的关怀对话',
    opening: '你好，我是学生心理关怀助手。你可以放心说说最近的感受或困扰。',
    quickPrompts: ['最近压力很大，怎么办？', '我总是睡不好。', '我担心申请材料来不及。'],
  },
  life: {
    title: '海外生活支持助手',
    subtitle: '为当前学生提供海外医疗、交通、住宿、安全和日常生活支持。',
    placeholder: '例如：在英国感冒了应该怎么就医？',
    emptyTitle: '新的生活咨询',
    opening: '你好，我可以协助解答医疗、交通、住宿、安全和日常生活问题。请告诉我所在国家或城市。',
    quickPrompts: ['在英国感冒了应该怎么就医？', '曼彻斯特如何乘坐公交？', '遇到紧急情况该怎么办？'],
  },
  program: {
    title: '学业提升咨询助手',
    subtitle: '基于当前学生的申请服务上下文，提供规划、科研和语言提升咨询。',
    placeholder: '例如：我想咨询英国硕博申请规划',
    emptyTitle: '新的项目咨询',
    opening: '你好，我可以协助梳理申请规划、科研背景、学术英语和学历提升方向。',
    quickPrompts: ['英国硕博申请要做哪些准备？', '我想提升科研背景。', '学术英语应该如何规划？'],
  },
}

function currentTime() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function newSession(id: number, title: string, opening: string): ChatSession {
  return {
    id,
    title,
    updatedAt: '刚刚',
    messages: [{ id: id + 1, role: 'assistant', content: opening, time: currentTime() }],
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '智能助手连接失败，请稍后重试'
}

export function StudentChatPage({ mode }: { mode: AssistantMode }) {
  const [sessionsByMode, setSessionsByMode] = useState<Record<AssistantMode, ChatSession[]>>(() => ({
    psych: [newSession(1, MODE_CONFIG.psych.emptyTitle, MODE_CONFIG.psych.opening)],
    life: [newSession(2, MODE_CONFIG.life.emptyTitle, MODE_CONFIG.life.opening)],
    program: [newSession(3, MODE_CONFIG.program.emptyTitle, MODE_CONFIG.program.opening)],
  }))
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const config = MODE_CONFIG[mode]

  // 每模式独立会话数组,模式间切换互不覆盖(照搬旧版 sessionsByMode)
  const sessions = sessionsByMode[mode]
  const activeSession = sessions.find((item) => item.id === activeSessionId) || sessions[0]

  useLayoutEffect(() => {
    const area = scrollAreaRef.current
    if (area) area.scrollTop = area.scrollHeight
  }, [activeSession?.messages.length, sending])

  function patchSession(sessionId: number, patch: (session: ChatSession) => ChatSession) {
    setSessionsByMode((prev) => ({ ...prev, [mode]: prev[mode].map((item) => item.id === sessionId ? patch(item) : item) }))
  }

  function createSession() {
    const session = newSession(Date.now(), config.emptyTitle, config.opening)
    setSessionsByMode((prev) => ({ ...prev, [mode]: [session, ...prev[mode]] }))
    setActiveSessionId(session.id)
    setInput('')
    setSendError('')
  }

  function removeSession(id: number) {
    if (sessions.length <= 1) {
      showToast('请至少保留一个会话')
      return
    }
    const next = sessions.filter((item) => item.id !== id)
    setSessionsByMode((prev) => ({ ...prev, [mode]: next }))
    if (activeSessionId === id) setActiveSessionId(next[0]?.id || null)
  }

  async function sendMessage(override?: string) {
    const content = (override ?? input).trim()
    if (!content || !activeSession || sending) return
    const sessionId = activeSession.id
    const userMessage: ChatMessage = { id: Date.now(), role: 'user', content, time: currentTime() }
    patchSession(sessionId, (item) => ({ ...item, title: content.slice(0, 18), updatedAt: '刚刚', messages: [...item.messages, userMessage] }))
    setInput('')
    setSending(true)
    setSendError('')
    try {
      // 对话身份由后端从登录 JWT 推导，前端不再传学生 ID
      const response = await chatStudent(mode, content, activeSession.conversationId)
      const reply: ChatMessage = { id: Date.now() + 1, role: 'assistant', content: response.answer, time: currentTime() }
      patchSession(sessionId, (item) => ({ ...item, conversationId: response.conversation_id || item.conversationId, messages: [...item.messages, reply] }))
    } catch (error) {
      const detail = errorMessage(error)
      setSendError(detail)
      showToast(detail, 'error')
      // 失败时在会话内追加提示气泡,而不是静默失败
      patchSession(sessionId, (item) => ({
        ...item,
        messages: [...item.messages, { id: Date.now() + 1, role: 'assistant' as MessageRole, content: '当前无法连接智能助手，请稍后重试或联系服务老师。', time: currentTime() }],
      }))
    } finally {
      setSending(false)
    }
  }

  return <section className="chat-page student-chat-page">
    <header className="student-chat-heading">
      <div><p>STUDENT SERVICE</p><h1>{config.title}</h1><span>{config.subtitle}</span></div>
    </header>
    <section className="chat-workspace">
      <aside className="session-sidebar">
        <div className="assistant-identity"><span className="assistant-icon"><Bot size={18} /></span><strong>{config.title}</strong></div>
        <button type="button" className="new-chat" onClick={createSession}><CirclePlus size={16} />开启新对话</button>
        <div className="session-list">{sessions.map((item) => <button key={item.id} type="button" className={`session-item${item.id === activeSessionId ? ' active' : ''}`} onClick={() => setActiveSessionId(item.id)}><span><strong>{item.title}</strong><small>{item.updatedAt}</small></span><span className="remove-session" role="button" tabIndex={-1} onClick={(event) => { event.stopPropagation(); removeSession(item.id) }}><Trash2 size={14} /></span></button>)}</div>
      </aside>
      <main className="conversation-main">
        <div className="service-note">{config.subtitle}</div>
        <div ref={scrollAreaRef} className="message-area">
          {activeSession?.messages.map((message, index) => <article key={message.id} className={`message-row ${message.role}`}>
            {message.role === 'assistant' && <span className="message-avatar"><Bot size={20} /></span>}
            <div className="message-bubble"><p>{message.content}</p>{message.role === 'assistant' && index === 0 && <div className="quick-prompts">{config.quickPrompts.map((question) => <button key={question} type="button" onClick={() => void sendMessage(question)}>{question}</button>)}</div>}</div>
          </article>)}
          {sending && <article className="message-row assistant"><span className="message-avatar"><Bot size={20} /></span><div className="message-bubble waiting"><p>正在请求服务...</p></div></article>}
        </div>
        {sendError && <div className="chat-error"><span>{sendError}</span><button type="button" onClick={() => setSendError('')}>关闭</button></div>}
        <div className="composer"><textarea rows={3} placeholder={config.placeholder} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); void sendMessage() } }} /><div><span>Ctrl + Enter 发送</span><Button variant="primary" size="sm" icon={<Send size={15} />} loading={sending} onClick={() => void sendMessage()}>发送</Button></div></div>
      </main>
    </section>
  </section>
}
