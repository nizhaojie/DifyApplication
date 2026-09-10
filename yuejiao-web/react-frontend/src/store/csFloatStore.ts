import { create } from 'zustand'
import { sendCsMessage } from '@/api/cs'
import { CS_WELCOME_TEXT } from '@/store/csQuickQuestions'

// 等价迁移自 Vue 版 stores/cs_chat.ts(粤小蜜悬浮球):
// - localStorage 键沿用 cs_visitor_session,刷新后会话与消息保留
// - 通信走后端 /api/v1/cs/chat(cs_session_id),不再浏览器直连 Dify
// - 回复打字机照搬 CsPage streamTypewriterText:按长度分档加速,14ms/帧

export interface CsMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface CsVisitorSession {
  session_id: string | null
  messages: CsMessage[]
}

const STORAGE_KEY = 'cs_visitor_session'

function createMessage(role: CsMessage['role'], content: string): CsMessage {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content }
}

function loadSession(): CsVisitorSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { session_id: null, messages: [] }
    const parsed = JSON.parse(raw) as CsVisitorSession
    if (!Array.isArray(parsed.messages)) return { session_id: null, messages: [] }
    return { session_id: parsed.session_id ?? null, messages: parsed.messages }
  } catch {
    return { session_id: null, messages: [] }
  }
}

function saveSession(session_id: string | null, messages: CsMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ session_id, messages } satisfies CsVisitorSession))
  } catch {
    // 存储不可用(隐私模式等)时仅放弃持久化,不影响对话
  }
}

interface CsFloatState {
  open: boolean
  replying: boolean
  sessionId: string | null
  messages: CsMessage[]
  togglePanel: () => void
  closePanel: () => void
  startNewSession: () => void
  sendUserText: (text: string) => Promise<void>
}

const initial = loadSession()
if (!initial.messages.length) initial.messages = [createMessage('assistant', CS_WELCOME_TEXT)]

export const useCsFloatStore = create<CsFloatState>((set, get) => ({
  sessionId: initial.session_id,
  messages: initial.messages,
  open: false,
  replying: false,

  togglePanel: () => set((state) => ({ open: !state.open })),
  closePanel: () => set({ open: false }),

  startNewSession: () => {
    const messages = [createMessage('assistant', CS_WELCOME_TEXT)]
    saveSession(null, messages)
    set({ sessionId: null, messages, replying: false })
  },

  async sendUserText(rawText) {
    const text = rawText.trim()
    if (!text || get().replying) return
    set((state) => {
      const messages = [...state.messages, createMessage('user', text)]
      saveSession(state.sessionId, messages)
      return { messages }
    })
    set({ replying: true })
    try {
      const response = await sendCsMessage({ session_id: get().sessionId ?? undefined, message: text })
      const sessionId = response.session_id || get().sessionId
      const replyId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      set((state) => {
        const messages = [...state.messages, { id: replyId, role: 'assistant' as const, content: '' }]
        saveSession(sessionId, messages)
        return { sessionId, messages }
      })
      const chars = Array.from(response.reply || '服务暂时没有返回内容，请稍后重试。')
      const step = chars.length > 200 ? 6 : chars.length > 80 ? 3 : 1
      let index = 0
      while (index < chars.length) {
        index = Math.min(index + step, chars.length)
        const content = chars.slice(0, index).join('')
        set((state) => ({ messages: state.messages.map((item) => (item.id === replyId ? { ...item, content } : item)) }))
        await new Promise((resolve) => setTimeout(resolve, 14))
      }
      saveSession(get().sessionId, get().messages)
    } catch {
      set((state) => {
        const messages = state.messages.map((item) => (
          item.role === 'assistant' && item.content === '' ? { ...item, content: '当前无法连接客服，请稍后重试。' } : item
        ))
        saveSession(state.sessionId, messages)
        return { messages }
      })
    } finally {
      set({ replying: false })
    }
  },
}))
