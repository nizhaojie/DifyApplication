import http, { type Envelope } from './http'

export interface StudentSummary {
  id: number
  user_id: number
  student_no: string | null
  name: string
  real_name: string
  school: string | null
  major: string | null
  grade: string | null
  abroad_country: string | null
  class_teacher_id: number | null
}

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

function targetParams(studentId: number) {
  return { params: { student_id: studentId } }
}

export async function fetchStudents() {
  const { data } = await http.get<Envelope<StudentSummary[]>>('/api/v1/student/students')
  return data.data || []
}

export async function fetchOverview(studentId: number) {
  const { data } = await http.get<Envelope<StudentOverview>>('/api/v1/student/overview', targetParams(studentId))
  return data.data
}

export async function fetchLeaves(studentId: number) {
  const { data } = await http.get<Envelope<StudentLeave[]>>('/api/v1/student/leaves', targetParams(studentId))
  return data.data || []
}

export async function createLeave(studentId: number, payload: {
  leave_type: string
  start_time: string
  end_time: string
  reason: string
  attachment_url?: string
}) {
  const { data } = await http.post<Envelope<StudentLeave>>('/api/v1/student/leaves', payload, targetParams(studentId))
  return data.data
}

export async function fetchTickets(studentId: number) {
  const { data } = await http.get<Envelope<StudentTicket[]>>('/api/v1/student/tickets', targetParams(studentId))
  return data.data || []
}

export async function createTicket(studentId: number, payload: {
  ticket_type: string
  category?: string
  title?: string
  content: string
  detail?: string
  priority: string
}) {
  const { data } = await http.post<Envelope<StudentTicket>>('/api/v1/student/tickets', payload, targetParams(studentId))
  return data.data
}

export async function fetchDeadlines(studentId: number) {
  const { data } = await http.get<Envelope<AcademicDeadline[]>>('/api/v1/student/academic/deadlines', targetParams(studentId))
  return data.data || []
}

export async function fetchScores(studentId: number) {
  const { data } = await http.get<Envelope<StudentScore[]>>('/api/v1/student/academic/scores', targetParams(studentId))
  return data.data || []
}

export async function fetchProgress(studentId: number) {
  const { data } = await http.get<Envelope<ApplicationProgress[]>>('/api/v1/student/application-progress', targetParams(studentId))
  return data.data || []
}

export async function createProgress(studentId: number, payload: {
  target_school: string
  target_major?: string
  progress_detail?: string
  deadline?: string
  next_action?: string
}) {
  const { data } = await http.post<Envelope<ApplicationProgress>>('/api/v1/student/application-progress', payload, targetParams(studentId))
  return data.data
}

export async function fetchPsychProfile(studentId: number) {
  const { data } = await http.get<Envelope<PsychProfile | null>>('/api/v1/student/psych/profile', targetParams(studentId))
  return data.data
}

export async function fetchKnowledge(studentId: number, params: { category?: string; keyword?: string } = {}) {
  const { data } = await http.get<Envelope<OverseasKnowledge[]>>('/api/v1/student/overseas/knowledge', {
    params: { ...params, student_id: studentId },
  })
  return data.data || []
}

export async function chatStudent(
  studentId: number,
  scene: 'psych' | 'life' | 'program',
  query: string,
  conversationId?: string | null,
) {
  const { data } = await http.post<Envelope<StudentChatResult>>(`/api/v1/student/chat/${scene}`, {
    query,
    conversation_id: conversationId || undefined,
  }, targetParams(studentId))
  return data.data
}
