/**
 * Type definitions for Yuejiao Customer Service (cs) module.
 * 等价迁移自 Vue 版 views/cs/types/csTypes.ts,一字不差。
 */

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  success: boolean
}

export interface ChatSession {
  id: number
  session_id: string
  visitor_name?: string
  visitor_contact?: string
  status: string
  last_message_time?: string
  create_time: string
}

export interface ChatMessageItem {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  intent?: string
  tokens_used?: number
  response_time_ms?: number
  create_time: string
}

export interface ChatRequest {
  session_id?: string
  message: string
  visitor_name?: string
  visitor_contact?: string
}

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

export interface CourseRecommendRequest {
  education_level?: string
  target_country?: string
  budget_max?: number
  interest_keyword?: string
  recommend_limit?: number
}

export interface CourseRecommendResponse {
  is_matched: boolean
  match_count: number
  recommended_courses: CourseProjectItem[]
  recommendation_rationale: string
  follow_up_suggestion?: string
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

export interface EventRegisterRequest {
  event_id: number
  customer_name: string
  contact_info: string
  remark?: string
}

export interface EventRegisterResponse {
  is_success: boolean
  registration_id?: number
  event_name: string
  message: string
}

export interface ChatResponse {
  session_id: string
  reply: string
  intent_code: string
  intent_name: string
  source_references: string[]
  card_type?: 'course_list' | 'event_list' | 'register_success' | string
  card_content?: any
  tokens_used: number
  response_time_ms: number
}

export interface FaqItem {
  id: number
  category: string
  question: string
  answer: string
  keywords: string[]
}

export interface UIConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  time: string
  intent_name?: string
  intent_code?: string
  tokens_used?: number
  response_time_ms?: number
  source_references?: string[]
  card_type?: string
  card_content?: any
  loading?: boolean
}
