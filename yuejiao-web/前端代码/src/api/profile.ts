/**
 * API client for Profile (客户研判) module.
 * Follows the shared axios instance (@/api/http) with JWT interceptor.
 */

import http from '@/api/http'
import type { Envelope } from '@/api/http'

export interface ProfileLanguageItem {
  lang: string
  level: string | null
}

export interface ProfileAssessment {
  product_line: string
  rule_name: string | null
  match_result: 'matched' | 'partial' | 'not_matched'
  match_score: number
  matched_labels: string[]
  candidate_programs: {
    programs: string[]
    category: string | null
    rationale: string | null
  }[]
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

export interface ProfileListResp {
  code: number
  message: string
  data: ProfileRecord[]
  total: number | null
}

const BASE = '/api/v1/profile'

/** 文本研判 */
export async function assessByText(text: string): Promise<AssessResult> {
  const form = new FormData()
  form.append('text', text)
  const { data } = await http.post<Envelope<AssessResult>>(`${BASE}/assess`, form)
  return data.data
}

/** 文件研判（PDF 简历 / Excel） */
export async function assessByFile(file: File): Promise<AssessResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<Envelope<AssessResult>>(`${BASE}/assess`, form)
  return data.data
}

/** 研判记录列表 */
export async function fetchProfiles(params: {
  limit?: number
  offset?: number
  match_result?: string
  matched_product?: string
}): Promise<ProfileListResp> {
  const { data } = await http.get<ProfileListResp>(`${BASE}/profiles`, { params })
  return data
}

/** 研判记录详情（后端会按当前规则重算 assessments） */
export async function fetchProfileDetail(id: number): Promise<AssessResult> {
  const { data } = await http.get<Envelope<AssessResult>>(`${BASE}/profiles/${id}`)
  return data.data
}
