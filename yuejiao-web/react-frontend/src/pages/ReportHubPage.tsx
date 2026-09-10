// 等价迁移自 Vue 版 前端代码/src/views/report/index.vue:
// 4 卡片导航,卡片视觉按 Vue(.card:白底、#e4e7ed 边、hover 变主题红)。
// 末尾说明块是原 React 超集保留内容,视觉沿用 Vue 卡片风格。
import { useNavigate } from 'react-router-dom'
import './report/report.css'

const items = [
  {
    path: '/report/customer-ops',
    title: '全域客户经营分析',
    hint: '意向、成交、流失与跟进停滞。',
  },
  {
    path: '/report/daily-summary',
    title: '员工日报智能汇总',
    hint: '按日或按周汇总提交覆盖与风险。',
  },
  {
    path: '/report/psych-weekly',
    title: '学生心理健康周报',
    hint: '情绪、预警与临近学业节点。',
  },
  {
    path: '/report/complaint-weekly',
    title: '投诉处理周报',
    hint: '工单量、类别、时效与满意度。',
  },
]

export function ReportHubPage() {
  const navigate = useNavigate()
  return (
    <section className="report-hub">
      <h1>智能报告</h1>
      <p className="hint">选一种报告手动生成，生成结果会落库，可回看历史。</p>
      <div className="cards">
        {items.map((item) => (
          <button
            key={item.path}
            className="card"
            type="button"
            onClick={() => navigate(item.path)}
          >
            <strong>{item.title}</strong>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>
      <section className="report-hub-note">
        <strong>报告生成链路</strong>
        <p>选定周期 → 手动生成 → 查看指标和洞察 → 从历史记录回看同类报告。</p>
      </section>
    </section>
  )
}
