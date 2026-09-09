export type ChatRole = 'user' | 'assistant'

export type PendingIntent = 'course_recommend' | 'event_register' | ''

export interface ChatMessage {
  message_id: string
  role: ChatRole
  content: string
  created_at: string
}

export interface CourseSlots {
  education_level: string
  intended_country: string
  budget: string
}

export interface EventSlots {
  event_name: string
  visitor_name: string
  contact_info: string
}

export interface VisitorSession {
  session_id: string
  messages: ChatMessage[]
  pending_intent: PendingIntent
  course_slots: CourseSlots
  event_slots: EventSlots
  dify_conversation_id: string
}

export interface ReplyDraft {
  assistant_text: string
  pending_intent: PendingIntent
  course_slots: CourseSlots
  event_slots: EventSlots
}

export interface QuickQuestion {
  question_id: string
  label: string
}
