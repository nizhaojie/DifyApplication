import http from './http'

export interface CourseProjectItem {
  id: number
  project_name: string
  category?: string
  description?: string
  target_audience?: string
  price?: number
  duration?: string
  tags?: string[]
  status: number
}

export interface EventLectureItem {
  id: number
  event_name: string
  event_type: string
  description?: string
  start_time: string
  end_time?: string
  location?: string
  max_participants?: number
  current_participants: number
  has_available_seats: boolean
  status: string
}

export interface FaqItem {
  id: number
  category: string
  question: string
  answer: string
  keywords: string[]
}

export interface ChatResponse {
  session_id: string
  reply: string
  intent_code: string
  intent_name: string
  source_references: string[]
  card_type?: string
  card_content?: unknown
  tokens_used: number
  response_time_ms: number
}

type CsEnvelope<T> = { code: number; message: string; data: T; success: boolean }

async function request<T>(url: string, config: Parameters<typeof http.get>[1] = {}) {
  const { data } = await http.get<CsEnvelope<T>>(url, config)
  return data.data
}

export async function sendCsMessage(payload: { session_id?: string; message: string }) {
  const { data } = await http.post<CsEnvelope<ChatResponse>>('/api/v1/cs/chat', payload, { timeout: 120000 })
  return data.data
}

export async function fetchFaqs() { return request<FaqItem[]>('/api/v1/cs/faqs') }
export async function fetchEvents() { return request<EventLectureItem[]>('/api/v1/cs/events') }
export async function fetchSessionMessages(sessionId: string) { return request<Record<string, unknown>[]>(`/api/v1/cs/sessions/${encodeURIComponent(sessionId)}/messages`) }

export async function registerEvent(payload: { event_id: number; customer_name: string; contact_info: string; remark?: string }) {
  const { data } = await http.post<CsEnvelope<Record<string, unknown>>>('/api/v1/cs/events/register', payload)
  return data.data
}

export async function recommendCourses(payload: { education_level?: string; target_country?: string; budget_max?: number; interest_keyword?: string; recommend_limit?: number }) {
  const { data } = await http.post<CsEnvelope<{ is_matched: boolean; match_count: number; recommended_courses: CourseProjectItem[]; recommendation_rationale: string; follow_up_suggestion?: string }>>('/api/v1/cs/courses/recommend', payload)
  return data.data
}
