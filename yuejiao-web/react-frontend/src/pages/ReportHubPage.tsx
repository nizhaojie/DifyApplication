import { ArrowRight, BarChart3, Brain, ClipboardList, FileBarChart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const items = [
  { path: '/report/customer-ops', title: '全域客户经营分析', hint: '意向、成交、流失与跟进停滞。', icon: BarChart3 },
  { path: '/report/daily-summary', title: '员工日报智能汇总', hint: '按日或按周汇总提交覆盖与风险。', icon: ClipboardList },
  { path: '/report/psych-weekly', title: '学生心理健康周报', hint: '情绪、预警与临近学业节点。', icon: Brain },
  { path: '/report/complaint-weekly', title: '投诉处理周报', hint: '工单量、类别、时效与满意度。', icon: FileBarChart },
]

export function ReportHubPage() {
  const navigate = useNavigate()
  return <section className="content-page report-hub-page"><header className="page-heading"><div><div className="eyebrow"><FileBarChart size={14} /> REPORT CENTER</div><h1>智能报告</h1><p>手动生成业务报告，查看当前周期和历史记录，让业务结果可以被复盘。</p></div></header><div className="report-hub-grid">{items.map(({ path, title, hint, icon: Icon }) => <button className="report-hub-card panel-surface" key={path} onClick={() => navigate(path)}><span className="report-icon"><Icon size={19} /></span><div><strong>{title}</strong><p>{hint}</p></div><ArrowRight size={16} /></button>)}</div><section className="panel-surface report-hub-note"><div className="report-note-mark"><FileBarChart size={18} /></div><div><strong>报告生成链路</strong><p>选定周期 → 手动生成 → 查看指标和洞察 → 从历史记录回看同类报告。</p></div></section></section>
}
