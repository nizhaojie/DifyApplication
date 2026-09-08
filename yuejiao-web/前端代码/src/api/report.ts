export type ReportKind = 'customer_ops' | 'daily_summary' | 'psych_weekly' | 'complaint_weekly'

export interface ReportRecord {
  id: number
  kind: ReportKind
  title: string
  period_start: string
  period_end: string
  status: 'generating' | 'completed' | 'failed'
  error_message: string | null
  content: {
    numbers: Record<string, unknown>
    insight: Record<string, string>
  } | null
  created_at: string | null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await response.json()
  if (!response.ok) {
    const detail = body.detail ?? body.message ?? '请求失败'
    throw new Error(typeof detail === 'string' ? detail : '请求失败')
  }
  if (body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

export function generateReport(kind: ReportKind, periodStart: string) {
  return request<ReportRecord>('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify({ kind, period_start: periodStart }),
  })
}

export function fetchCurrentReport(kind: ReportKind, periodStart: string) {
  const query = new URLSearchParams({ kind, period_start: periodStart })
  return request<ReportRecord | null>(`/api/reports/current?${query}`)
}

export function fetchReportHistory(kind: ReportKind) {
  const query = new URLSearchParams({ kind })
  return request<ReportRecord[]>(`/api/reports/history?${query}`)
}
