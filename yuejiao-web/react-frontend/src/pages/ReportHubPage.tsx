import { ArrowRight, BarChart3, Brain, ClipboardList, FileBarChart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '@/ui'

const items = [
  { path: '/report/customer-ops', title: '全域客户经营分析', hint: '意向、成交、流失与跟进停滞。', icon: BarChart3 },
  { path: '/report/daily-summary', title: '员工日报智能汇总', hint: '按日或按周汇总提交覆盖与风险。', icon: ClipboardList },
  { path: '/report/psych-weekly', title: '学生心理健康周报', hint: '情绪、预警与临近学业节点。', icon: Brain },
  { path: '/report/complaint-weekly', title: '投诉处理周报', hint: '工单量、类别、时效与满意度。', icon: FileBarChart },
]

export function ReportHubPage() {
  const navigate = useNavigate()
  return <section>
    <PageHeader
      eyebrow={<><FileBarChart size={13} />Report Center</>}
      title="智能报告"
      desc="手动生成业务报告，查看当前周期和历史记录，让业务结果可以被复盘。"
    />
    <div className="report-hub" style={{ marginBottom: 20 }}>
      {items.map(({ path, title, hint, icon: Icon }) => (
        <button className="hub-card" key={path} onClick={() => navigate(path)}>
          <span className="hub-icon"><Icon size={17} /></span>
          <div>
            <strong>{title}</strong>
            <p>{hint}</p>
          </div>
          <ArrowRight size={15} />
        </button>
      ))}
    </div>
    <Panel className="hero-banner">
      <span className="company-seal"><FileBarChart size={20} /></span>
      <div>
        <h2>报告生成链路</h2>
        <p>选定周期 → 手动生成 → 查看指标和洞察 → 从历史记录回看同类报告。生成结果会落库，可随时复盘。</p>
      </div>
    </Panel>
  </section>
}
