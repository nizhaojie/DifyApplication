import { ArrowRight, ClipboardCheck, HeartPulse, MessageCircle, NotebookPen, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function StudentPage() {
  const navigate = useNavigate()
  const modules = [
    { icon: ClipboardCheck, title: '请假管理', description: '连接企业助手的审批工作流，统一查看待审批事项。', path: '/enterprise' },
    { icon: HeartPulse, title: '心理关怀', description: '保留学生心理服务入口，后续接入记录和风险预警。', path: '/report/psych-weekly' },
    { icon: MessageCircle, title: '投诉与反馈', description: '从客服 Agent 进入咨询和问题反馈闭环。', path: '/cs' },
    { icon: NotebookPen, title: '学习进度', description: '学生服务模块的统一入口，按业务逐步接入。', path: '/report' },
  ]
  return <section className="content-page student-page">
    <header className="page-heading"><div><div className="eyebrow"><UserRound size={14} /> STUDENT SERVICE</div><h1>学生助手</h1><p>把学生服务事项收进同一套业务入口，当前可直接进入已接入的客服、审批和报告链路。</p></div></header>
    <section className="student-hero panel-surface"><div className="student-hero-icon"><UserRound size={26} /></div><div><span className="eyebrow">SERVICE HUB</span><h2>学生服务中心</h2><p>选择一个服务方向继续办理。学生端原始路由保持不变，已接入能力从对应业务页面进入。</p></div></section>
    <div className="student-module-grid">{modules.map(({ icon: Icon, title, description, path }) => <button className="student-module panel-surface" key={title} onClick={() => navigate(path)}><span className="student-module-icon"><Icon size={19} /></span><div><strong>{title}</strong><p>{description}</p></div><ArrowRight size={16} /></button>)}</div>
  </section>
}
