import http from '@/api/http'
import type { Envelope } from '@/api/http'

export type ReportKind = 'customer_ops' | 'daily_summary' | 'weekly_summary' | 'psych_weekly' | 'complaint_weekly'

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

const REPORT_TIMEOUT = 120000

export async function generateReport(kind: ReportKind, periodStart: string) {
  const { data } = await http.post<Envelope<ReportRecord>>(
    '/api/v1/reports/generate',
    { kind, period_start: periodStart },
    { timeout: REPORT_TIMEOUT },
  )
  return data.data
}

export async function fetchCurrentReport(kind: ReportKind, periodStart: string) {
  const { data } = await http.get<Envelope<ReportRecord | null>>('/api/v1/reports/current', {
    params: { kind, period_start: periodStart },
  })
  return data.data
}

export async function fetchReportHistory(kind: ReportKind) {
  const { data } = await http.get<Envelope<ReportRecord[]>>('/api/v1/reports/history', {
    params: { kind },
  })
  return data.data || []
}
