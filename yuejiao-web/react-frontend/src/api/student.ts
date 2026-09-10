import http, { type Envelope } from './http'

export interface StudentOverview {
  pending_leaves: number
  open_tickets: number
  upcoming_deadlines: number
  open_psych_alerts: number
}

export interface StudentLeave {
  id: number
  leave_type: string | null
  start_time: string | null
  end_time: string | null
  reason: string
  status: string
  approval_comment?: string | null
  create_time?: string
}

export interface StudentTicket {
  id: number
  ticket_type: string
  category: string | null
  title: string | null
  content: string
  detail?: string | null
  status: string
  priority: string
  solution?: string | null
  create_time?: string
}

export interface AcademicDeadline {
  id: number
  deadline_type: string
  title: string
  description: string | null
  deadline: string
  status: string
}

export interface StudentScore {
  id: number
  course_name: string
  score: number | string
  semester: string | null
  credit: number | string | null
}

export interface ApplicationProgress {
  id: number
  target_school: string
  target_major: string | null
  stage: string
  progress_detail: string | null
  deadline: string | null
  next_action: string | null
  update_time?: string
}

export interface PsychProfile {
  latest_emotion_tag: string | null
  emotion_score: number | null
  last_interaction_time: string | null
  risk_level: string
  weekly_summary: Record<string, string> | null
}

export interface OverseasKnowledge {
  id: number
  country: string
  category: string
  title: string
  content: string
}

export interface StudentChatResult {
  answer: string
  conversation_id: string | null
  message_id: string | null
}

// 学生身份由后端从登录 JWT 推导，接口不再接受 student_id 参数
export async function fetchOverview() {
  const { data } = await http.get<Envelope<StudentOverview>>('/api/v1/student/overview')
  return data.data
}

export async function fetchLeaves() {
  const { data } = await http.get<Envelope<StudentLeave[]>>('/api/v1/student/leaves')
  return data.data || []
}

export async function createLeave(payload: {
  leave_type: string
  start_time: string
  end_time: string
  reason: string
  attachment_url?: string
}) {
  const { data } = await http.post<Envelope<StudentLeave>>('/api/v1/student/leaves', payload)
  return data.data
}

export async function fetchTickets() {
  const { data } = await http.get<Envelope<StudentTicket[]>>('/api/v1/student/tickets')
  return data.data || []
}

export async function createTicket(payload: {
  ticket_type: string
  category?: string
  title?: string
  content: string
  detail?: string
  priority: string
}) {
  const { data } = await http.post<Envelope<StudentTicket>>('/api/v1/student/tickets', payload)
  return data.data
}

export async function fetchDeadlines() {
  const { data } = await http.get<Envelope<AcademicDeadline[]>>('/api/v1/student/academic/deadlines')
  return data.data || []
}

export async function fetchScores() {
  const { data } = await http.get<Envelope<StudentScore[]>>('/api/v1/student/academic/scores')
  return data.data || []
}

export async function fetchProgress() {
  const { data } = await http.get<Envelope<ApplicationProgress[]>>('/api/v1/student/application-progress')
  return data.data || []
}

export async function createProgress(payload: {
  target_school: string
  target_major?: string
  progress_detail?: string
  deadline?: string
  next_action?: string
}) {
  const { data } = await http.post<Envelope<ApplicationProgress>>('/api/v1/student/application-progress', payload)
  return data.data
}

export async function fetchPsychProfile() {
  const { data } = await http.get<Envelope<PsychProfile | null>>('/api/v1/student/psych/profile')
  return data.data
}

export async function fetchKnowledge(params: { category?: string; keyword?: string } = {}) {
  const { data } = await http.get<Envelope<OverseasKnowledge[]>>('/api/v1/student/overseas/knowledge', { params })
  return data.data || []
}

export async function chatStudent(
  scene: 'psych' | 'life' | 'program',
  query: string,
  conversationId?: string | null,
) {
  const { data } = await http.post<Envelope<StudentChatResult>>(`/api/v1/student/chat/${scene}`, {
    query,
    conversation_id: conversationId || undefined,
  })
  return data.data
}
