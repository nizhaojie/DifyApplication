import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from '@/components/feedback'
import { ChatDotRound, CirclePlus, Delete, Promotion } from '@/components/elementIcons'
import './studentChat.css'

// 等价迁移自 Vue 版 views/student/chat.vue:psych/life/program 三模式共页,
// 每模式独立会话数组(内存态,不持久化),Ctrl+Enter 发送,X-User-Id 伪造用户(照搬 Vue 行为)。

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
  conversationId?: string
  messages: ChatMessage[]
}

const apiBase = 'http://127.0.0.1:8002/api/v1/student'

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
    subtitle: '为学生提供支持性回应、情绪陪伴和高风险分流引导。',
    placeholder: '写下你现在的感受',
    emptyTitle: '开启新的关怀对话',
    opening: '你好，我是学生心理关怀助手。你可以放心说说最近的感受或困扰。',
    quickPrompts: ['最近压力很大，怎么办？', '我总是睡不好。', '我担心申请材料来不及。'],
  },
  life: {
    title: '海外生活支持助手',
    subtitle: '为留学生提供海外医疗、交通、住宿、安全和日常生活支持。',
    placeholder: '例如：在英国感冒了应该怎么就医？',
    emptyTitle: '开启新的生活咨询',
    opening: '你好，我可以协助解答医疗、交通、住宿、安全和日常生活问题。请告诉我所在国家或城市。',
    quickPrompts: ['在英国感冒了应该怎么就医？', '曼彻斯特如何乘坐公交？', '遇到紧急情况该怎么办？'],
  },
  program: {
    title: '学业提升咨询助手',
    subtitle: '基于增值服务知识库，提供申请规划、科研和语言提升咨询。',
    placeholder: '例如：我想咨询英国硕博申请规划',
    emptyTitle: '开启新的项目咨询',
    opening: '你好，我可以协助梳理申请规划、科研背景、学术英语和学历提升方向。',
    quickPrompts: ['英国硕博申请要做哪些准备？', '我想提升科研背景。', '学术英语应该如何规划？'],
  },
}

function currentTime() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function newSession(id: number, title: string): ChatSession {
  return { id, title, updatedAt: '刚刚', messages: [] }
}

const INITIAL_SESSIONS: Record<AssistantMode, ChatSession[]> = {
  psych: [newSession(1, '新的关怀对话')],
  life: [newSession(2, '新的生活咨询')],
  program: [newSession(3, '新的项目咨询')],
}

export function StudentChatPage({ mode }: { mode: AssistantMode }) {
  const [sessionsByMode, setSessionsByMode] = useState<Record<AssistantMode, ChatSession[]>>(INITIAL_SESSIONS)
  const [activeSessionId, setActiveSessionId] = useState(1)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const config = MODE_CONFIG[mode]
  const sessions = sessionsByMode[mode]
  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? sessions[0]

  const scrollToBottom = () => {
    const area = scrollAreaRef.current
    if (area) area.scrollTop = area.scrollHeight
  }

  useLayoutEffect(() => {
    scrollToBottom()
  }, [activeSession?.messages.length, sending, mode])

  // 对齐 Vue watch(mode, {immediate:true}):切模式时重置活动会话/输入框,并注入开场白
  useEffect(() => {
    const first = sessionsByMode[mode][0]
    setActiveSessionId(first.id)
    setInput('')
    setSessionsByMode((prev) => {
      const list = prev[mode]
      if (list.length > 0 && list[0].messages.length === 0) {
        const opening: ChatMessage = {
          id: list[0].id + 1,
          role: 'assistant',
          content: MODE_CONFIG[mode].opening,
          time: currentTime(),
        }
        return {
          ...prev,
          [mode]: [{ ...list[0], messages: [opening] }, ...list.slice(1)],
        }
      }
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const patchSession = (sessionId: number, patch: (session: ChatSession) => ChatSession) => {
    setSessionsByMode((prev) => ({
      ...prev,
      [mode]: prev[mode].map((item) => (item.id === sessionId ? patch(item) : item)),
    }))
  }

  const selectSession = (id: number) => {
    setActiveSessionId(id)
  }

  const createSession = () => {
    const id = Date.now()
    const session = newSession(id, config.emptyTitle)
    setSessionsByMode((prev) => ({
      ...prev,
      [mode]: [session, ...prev[mode]],
    }))
    setActiveSessionId(id)
    // 与 Vue 一致:新建后立刻注入开场白
    patchSession(id, (item) => ({
      ...item,
      messages: [{ id: item.id + 1, role: 'assistant', content: config.opening, time: currentTime() }],
    }))
  }

  const removeSession = (id: number) => {
    if (sessions.length === 1) {
      toast.warning('请至少保留一个会话')
      return
    }
    const rest = sessions.filter((item) => item.id !== id)
    setSessionsByMode((prev) => ({ ...prev, [mode]: rest }))
    if (activeSessionId === id) setActiveSessionId(rest[0].id)
  }

  const quickAsk = (question: string) => {
    void sendMessage(question)
  }

  const sendMessage = async (override?: string) => {
    const content = (override ?? input).trim()
    const session = activeSession
    if (!content || !session || sending) return

    const userMessage: ChatMessage = { id: Date.now(), role: 'user', content, time: currentTime() }
    patchSession(session.id, (item) => ({
      ...item,
      title: content.slice(0, 18),
      updatedAt: '刚刚',
      messages: [...item.messages, userMessage],
    }))
    setInput('')
    setSending(true)

    try {
      const response = await fetch(`${apiBase}/chat/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': '1' },
        body: JSON.stringify({ query: content, conversation_id: session.conversationId }),
      })
      const payload = await response.json()
      if (!response.ok || payload.code !== 200) {
        throw new Error(payload.detail ?? payload.message ?? 'Dify 调用失败')
      }
      const reply: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: payload.data.answer,
        time: currentTime(),
      }
      patchSession(session.id, (item) => ({
        ...item,
        conversationId: payload.data.conversation_id ?? item.conversationId,
        messages: [...item.messages, reply],
      }))
    } catch (error) {
      const fallback: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '当前无法连接智能助手，请稍后重试或联系服务老师。',
        time: currentTime(),
      }
      patchSession(session.id, (item) => ({ ...item, messages: [...item.messages, fallback] }))
      toast.error(error instanceof Error ? error.message : '智能助手连接失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="chat-page">
      <header className="chat-heading">
        <div>
          <p>STUDENT AI SERVICE</p>
          <h1>{config.title}</h1>
        </div>
        <span className="dify-tag">Dify 已接入</span>
      </header>

      <section className="chat-workspace">
        <aside className="session-sidebar">
          <div className="assistant-identity">
            <span className="assistant-icon">
              <ChatDotRound />
            </span>
            <strong>{config.title}</strong>
          </div>
          <button type="button" className="new-chat" onClick={createSession}>
            <CirclePlus /> 开启新对话
          </button>
          <div className="session-list">
            {sessions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`session-item${item.id === activeSessionId ? ' active' : ''}`}
                onClick={() => selectSession(item.id)}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.updatedAt}</small>
                </span>
                <span
                  className="remove-session"
                  role="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation()
                    removeSession(item.id)
                  }}
                >
                  <Delete />
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="conversation-main">
          <div className="service-note">{config.subtitle}</div>
          <div ref={scrollAreaRef} className="message-area">
            {activeSession?.messages.map((message, index) => (
              <article key={message.id} className={`message-row ${message.role}`}>
                {message.role === 'assistant' ? (
                  <span className="message-avatar">
                    <ChatDotRound />
                  </span>
                ) : null}
                <div className="message-bubble">
                  <p>{message.content}</p>
                  {message.role === 'assistant' && index === 0 ? (
                    <div className="quick-prompts">
                      {config.quickPrompts.map((question) => (
                        <button key={question} type="button" onClick={() => quickAsk(question)}>
                          {question}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            {sending ? (
              <article className="message-row assistant">
                <span className="message-avatar">
                  <ChatDotRound />
                </span>
                <div className="message-bubble waiting">
                  <p>正在思考...</p>
                </div>
              </article>
            ) : null}
          </div>
          <div className="composer">
            <textarea
              rows={3}
              placeholder={config.placeholder}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.ctrlKey && event.key === 'Enter') {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
            />
            <div>
              <span>Ctrl + Enter 发送</span>
              <button type="button" className="send-btn" disabled={sending} onClick={() => void sendMessage()}>
                <Promotion /> 发送
              </button>
            </div>
          </div>
        </main>
      </section>
    </section>
  )
}
