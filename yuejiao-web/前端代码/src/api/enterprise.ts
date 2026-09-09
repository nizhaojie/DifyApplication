import http from '@/api/http'
import type { Envelope } from '@/api/http'

export interface LeadItem {
  id: number
  customer_name: string
  contact_info: string | null
  intended_country: string | null
  intended_major: string | null
  education_level: string | null
  status: string
  status_text: string
  owner_name: string | null
  remark: string | null
  last_contact_time: string | null
  create_time: string
}

export interface FollowUpItem {
  id: number
  lead_id: number
  employee_id: number
  follow_type: string | null
  content: string
  next_plan: string | null
  create_time: string
}

export interface OrgItem {
  id: number
  org_name: string
  parent_id: number | null
  org_level: number
  sort_order: number
}

export interface ChatResult {
  reply: string
  conversation_id: string | null
  source: string
  intent?: string
  citation?: string
  title?: string
  data?: Record<string, unknown>
  dify_fallback?: string
}

export async function chat(query: string, conversationId?: string | null) {
  const { data } = await http.post<Envelope<ChatResult>>(
    '/api/v1/enterprise/chat',
    {
      query,
      conversation_id: conversationId || undefined,
    },
    { timeout: 120000 },
  )
  return data.data
}

export async function fetchChatStatus() {
  const { data } = await http.get<
    Envelope<{ dify_enabled: boolean; source: string; app_hint: string; online?: boolean }>
  >('/api/v1/enterprise/chat-status')
  return data.data
}

export async function fetchBrief() {
  const { data } = await http.get<Envelope<Record<string, unknown>>>('/api/v1/enterprise/brief')
  return data.data
}

export async function fetchFunnel() {
  const { data } = await http.get<Envelope<Record<string, number>>>('/api/v1/enterprise/funnel')
  return data.data
}

export async function fetchLeads(params: { keyword?: string; status?: string }) {
  const { data } = await http.get<Envelope<LeadItem[]>>('/api/v1/enterprise/leads', { params })
  return { items: data.data || [], total: data.total || 0 }
}

export async function fetchLeadDetail(id: number) {
  const { data } = await http.get<Envelope<{ lead: LeadItem; follow_ups: FollowUpItem[] }>>(
    `/api/v1/enterprise/leads/${id}`,
  )
  return data.data
}

export async function addFollowUp(id: number, content: string, next_plan?: string) {
  const { data } = await http.post<Envelope<FollowUpItem>>(`/api/v1/enterprise/leads/${id}/follow-ups`, {
    content,
    follow_type: 'other',
    next_plan,
  })
  return data.data
}

export async function updateLeadStatus(id: number, status: string, lost_reason?: string) {
  const { data } = await http.put<Envelope<LeadItem>>(`/api/v1/enterprise/leads/${id}/status`, {
    status,
    lost_reason,
  })
  return data.data
}

export async function fetchDailies() {
  const { data } = await http.get<Envelope<Record<string, unknown>[]>>('/api/v1/enterprise/dailies')
  return { items: data.data || [], total: data.total || 0 }
}

export async function fetchLeaves(status = 'pending') {
  const { data } = await http.get<Envelope<Record<string, unknown>[]>>('/api/v1/enterprise/leaves', {
    params: { status },
  })
  return { items: data.data || [], total: data.total || 0 }
}

export async function approveLeave(id: number, action: 'approved' | 'rejected', comment?: string) {
  const { data } = await http.post<Envelope<Record<string, unknown>>>(`/api/v1/enterprise/leaves/${id}/approve`, {
    action,
    approval_comment: comment,
  })
  return data.data
}
export async function fetchStudentProgress(stage?: string) { const { data } = await http.get<Envelope<Record<string, unknown>[]>>('/api/v1/enterprise/student-progress', { params: stage ? { stage } : undefined }); return data.data || [] }
export async function updateStudentProgress(id: number, status: string, content: string, next_plan: string) { const { data } = await http.put<Envelope<Record<string, unknown>>>(`/api/v1/enterprise/student-progress/${id}`, { status, content, next_plan }); return data.data }
export async function fetchStudentTickets(status?: string) { const { data } = await http.get<Envelope<Record<string, unknown>[]>>('/api/v1/enterprise/tickets', { params: status ? { status } : undefined }); return data.data || [] }
export async function handleStudentTicket(id: number, action: string, solution: string) { const { data } = await http.post<Envelope<Record<string, unknown>>>(`/api/v1/enterprise/tickets/${id}/handle`, { action, solution }); return data.data }

export async function fetchCompany() {
  const { data } = await http.get<Envelope<Record<string, unknown>>>('/api/v1/enterprise/company')
  return data.data
}

export async function fetchOrgs() {
  const { data } = await http.get<Envelope<OrgItem[]>>('/api/v1/enterprise/orgs')
  return data.data || []
}

export async function fetchGuideCatalog() {
  const { data } = await http.get<Envelope<{ title: string; excerpt: string; content?: string }[]>>(
    '/api/v1/enterprise/guide-catalog',
  )
  return data.data || []
}

export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  source?: string | null
  intent?: string | null
  create_time?: string
}

export interface MemorySnapshot {
  session_id: string
  conversation_id: string | null
  last_person: string | null
  preferred_name: string | null
  total: number
  messages: MemoryMessage[]
}

export async function fetchMemory() {
  const { data } = await http.get<Envelope<MemorySnapshot>>('/api/v1/enterprise/memory')
  return data.data
}

export async function clearMemory() {
  const { data } = await http.delete<Envelope<{ cleared: boolean }>>('/api/v1/enterprise/memory')
  return data.data
}
