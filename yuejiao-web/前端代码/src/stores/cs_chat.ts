import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { is_dify_chat_enabled, request_dify_chat } from '@/stores/cs_dify_client'
import { request_assistant_reply } from '@/stores/cs_mock_reply'
import { CS_WELCOME_TEXT } from '@/stores/cs_quick_questions'
import type {
  ChatMessage,
  CourseSlots,
  EventSlots,
  PendingIntent,
  VisitorSession,
} from '@/stores/cs_types'

const STORAGE_KEY = 'cs_visitor_session'
const REPLY_DELAY_MS = 280
const DIFY_ERROR_TEXT = '粤小蜜暂时连不上，请稍后再试。'

function empty_course_slots(): CourseSlots {
  return { education_level: '', intended_country: '', budget: '' }
}

function empty_event_slots(): EventSlots {
  return { event_name: '', visitor_name: '', contact_info: '' }
}

function create_session_id(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sess_${crypto.randomUUID()}`
  }
  return `sess_${Date.now()}`
}

function create_message_id(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function create_message(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    message_id: create_message_id(),
    role,
    content,
    created_at: new Date().toISOString(),
  }
}

function create_blank_session(): VisitorSession {
  return {
    session_id: create_session_id(),
    messages: [create_message('assistant', CS_WELCOME_TEXT)],
    pending_intent: '',
    course_slots: empty_course_slots(),
    event_slots: empty_event_slots(),
    dify_conversation_id: '',
  }
}

function is_session_shape(candidate: unknown): candidate is VisitorSession {
  if (!candidate || typeof candidate !== 'object') return false
  const session = candidate as VisitorSession
  return (
    typeof session.session_id === 'string' &&
    Array.isArray(session.messages) &&
    typeof session.pending_intent === 'string' &&
    !!session.course_slots &&
    !!session.event_slots
  )
}

function load_session(): VisitorSession {
  try {
    const raw_session = localStorage.getItem(STORAGE_KEY)
    if (!raw_session) return create_blank_session()
    const parsed_session: unknown = JSON.parse(raw_session)
    if (!is_session_shape(parsed_session) || parsed_session.messages.length === 0) {
      return create_blank_session()
    }
    if (typeof parsed_session.dify_conversation_id !== 'string') {
      parsed_session.dify_conversation_id = ''
    }
    return parsed_session
  } catch {
    return create_blank_session()
  }
}

function persist_session(session: VisitorSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function wait_for(delay_ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay_ms)
  })
}

export const useCsChatStore = defineStore('cs_chat', () => {
  const is_open = ref(false)
  const is_replying = ref(false)
  const session = ref<VisitorSession>(load_session())

  const messages = computed(() => session.value.messages)
  const has_user_message = computed(() =>
    session.value.messages.some((item) => item.role === 'user'),
  )

  watch(
    session,
    (current_session) => {
      persist_session(current_session)
    },
    { deep: true },
  )

  function open_panel(): void {
    is_open.value = true
  }

  function close_panel(): void {
    is_open.value = false
  }

  function toggle_panel(): void {
    is_open.value = !is_open.value
  }

  function start_new_session(): void {
    session.value = create_blank_session()
    persist_session(session.value)
  }

  function apply_reply_fields(
    pending_intent: PendingIntent,
    course_slots: CourseSlots,
    event_slots: EventSlots,
  ): void {
    session.value.pending_intent = pending_intent
    session.value.course_slots = course_slots
    session.value.event_slots = event_slots
  }

  async function send_user_text(raw_text: string): Promise<void> {
    const user_text = raw_text.trim()
    if (!user_text || is_replying.value) return

    is_open.value = true
    session.value.messages.push(create_message('user', user_text))
    is_replying.value = true

    if (is_dify_chat_enabled()) {
      const msg_box = { current: null as ChatMessage | null }
      try {
        const chat_result = await request_dify_chat(
          user_text,
          session.value.session_id,
          session.value.dify_conversation_id,
          (latest_text) => {
            if (!msg_box.current) {
              msg_box.current = create_message('assistant', '')
              session.value.messages.push(msg_box.current)
            }
            msg_box.current.content = latest_text
          },
        )
        if (msg_box.current) {
          msg_box.current.content = chat_result.assistant_text
        } else {
          session.value.messages.push(create_message('assistant', chat_result.assistant_text))
        }
        session.value.dify_conversation_id = chat_result.conversation_id
      } catch {
        if (msg_box.current) {
          msg_box.current.content = DIFY_ERROR_TEXT
        } else {
          session.value.messages.push(create_message('assistant', DIFY_ERROR_TEXT))
        }
      }
      is_replying.value = false
      return
    }

    await wait_for(REPLY_DELAY_MS)
    const reply_draft = request_assistant_reply(user_text, session.value)
    apply_reply_fields(
      reply_draft.pending_intent,
      reply_draft.course_slots,
      reply_draft.event_slots,
    )
    session.value.messages.push(create_message('assistant', reply_draft.assistant_text))
    is_replying.value = false
  }

  return {
    is_open,
    is_replying,
    session,
    messages,
    has_user_message,
    open_panel,
    close_panel,
    toggle_panel,
    start_new_session,
    send_user_text,
  }
})
