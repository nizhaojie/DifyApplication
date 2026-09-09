import http, { type Envelope } from './http'

export interface ProfileAssessment {
  product_line: string
  rule_name: string | null
  match_result: 'matched' | 'partial' | 'not_matched'
  match_score: number
  matched_labels: string[]
  candidate_programs: { programs: string[]; category: string | null; rationale: string | null }[]
}

export interface AssessResult {
  id: number | null
  source_id: number | null
  customer_name: string | null
  match_result: 'matched' | 'partial' | 'not_matched' | null
  matched_product: string | null
  match_score: number | null
  match_reason: string | null
  recommended_programs: string[] | null
  background_info: Record<string, unknown> | null
  assessments: ProfileAssessment[]
}

export interface ProfileRecord {
  id: number
  customer_name: string | null
  match_result: string | null
  matched_product: string | null
  match_score: number | null
  create_time: string | null
}

const BASE = '/api/v1/profile'

export async function assessByText(text: string) {
  const form = new FormData()
  form.append('text', text)
  const { data } = await http.post<Envelope<AssessResult>>(`${BASE}/assess`, form)
  return data.data
}

export async function assessByFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<Envelope<AssessResult>>(`${BASE}/assess`, form)
  return data.data
}

export async function fetchProfiles(params: { limit?: number; offset?: number; match_result?: string; matched_product?: string }) {
  const { data } = await http.get<Envelope<ProfileRecord[]>>(`${BASE}/profiles`, { params })
  return { items: data.data || [], total: data.total || 0 }
}

export async function fetchProfileDetail(id: number) {
  const { data } = await http.get<Envelope<AssessResult>>(`${BASE}/profiles/${id}`)
  return data.data
}
