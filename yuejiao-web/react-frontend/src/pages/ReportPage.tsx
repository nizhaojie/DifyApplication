// 按报告种类分发到等价移植的四个报表子页(Vue 版 views/report/{customer-ops,daily-summary,psych-weekly,complaint-weekly}.vue)。
// App.tsx 路由保持不变,仍传 kind prop。
import type { ReportKind } from '@/api/report'
import { CustomerOpsPage } from './report/CustomerOpsPage'
import { DailySummaryPage } from './report/DailySummaryPage'
import { PsychWeeklyPage } from './report/PsychWeeklyPage'
import { ComplaintWeeklyPage } from './report/ComplaintWeeklyPage'

export function ReportPage({ kind }: { kind: ReportKind }) {
  if (kind === 'customer_ops') return <CustomerOpsPage />
  if (kind === 'daily_summary') return <DailySummaryPage />
  if (kind === 'psych_weekly') return <PsychWeeklyPage />
  return <ComplaintWeeklyPage />
}
