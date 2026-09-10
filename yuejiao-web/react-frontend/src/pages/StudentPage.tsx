import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DatePicker, Empty, Input, Modal, Radio, Select, Spin, Table, Tabs, Tag } from 'antd'
import type { TableProps } from 'antd'
import type { Dayjs } from 'dayjs'
import { toast } from '@/components/feedback'
import {
  Calendar,
  ChatDotRound,
  CircleCheck,
  DocumentChecked,
  Promotion,
  Reading,
  School,
  Service,
  Timer,
  Warning,
} from '@/components/elementIcons'
import './StudentPage.css'

// 等价迁移自 Vue 版 views/student/index.vue(完整学生智能助手页,替换原 4 张跳转卡占位版):
// - 数据层照搬:页内原生 fetch(硬编码 http://127.0.0.1:8002/api/v1/student、X-User-Id '1'、10s AbortController、
//   解包 {code,data}),端点 /overview、/leaves(GET/POST)、/tickets(GET/POST)、/academic/deadlines、
//   /academic/scores?all_students=true、/application-progress(GET/POST)
// - 降级照搬:加载失败 usingRemoteData=false,保留内置演示数据,顶部显示「演示数据模式 / 已连接业务服务」
// - 4 张可点 KPI 卡联动 Tab;助手正则意图路由;6 个 Tab;请假/工单/申请进度弹窗
// - 生活与关怀 Tab 三卡改为路由跳转(与 Vue 一致),心理倾诉 dialog 保留但无入口(照搬 Vue 现状)

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type TicketStatus = 'pending' | 'processing' | 'resolved' | 'closed'
type SupportMode = 'psych' | 'life' | 'program'
type MessageRole = 'assistant' | 'user'

interface LeaveItem {
  id: number
  leave_type: string
  start_time: string
  end_time: string
  reason: string
  status: LeaveStatus
  approval_comment?: string
}

interface TicketItem {
  id: number
  ticket_type: string
  category: string
  title: string
  content: string
  status: TicketStatus
  priority: string
  solution?: string
}

interface DeadlineItem {
  id: number
  deadline_type: string
  title: string
  description?: string
  deadline: string
  status: string
}

interface ScoreItem {
  id: number
  student_id: number
  course_name: string
  score: number
  semester?: string
  credit?: number
}

interface ProgressItem {
  id: number
  target_school: string
  target_major?: string
  stage: string
  progress_detail?: string
  deadline?: string
  next_action?: string
}

interface Overview {
  pending_leaves: number
  open_tickets: number
  upcoming_deadlines: number
  open_psych_alerts: number
}

interface PsychMessage {
  role: MessageRole
  content: string
}

const apiBase = 'http://127.0.0.1:8002/api/v1/student'

const currentStudent = {
  name: '张明',
  studentNo: 'YJ2026001',
  school: '曼彻斯特大学',
}

const stageLabel: Record<string, string> = {
  document_prep: '材料准备',
  submitted: '已提交',
  under_review: '院校审核中',
  offer_received: '已获录取',
  visa_processing: '签证办理中',
  enrolled: '已入学',
}

const leaveStatusMap: Record<LeaveStatus, { label: string; type: 'warning' | 'success' | 'danger' | 'info' }> = {
  pending: { label: '待审批', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '未通过', type: 'danger' },
  cancelled: { label: '已撤销', type: 'info' },
}

const ticketStatusMap: Record<TicketStatus, { label: string; type: 'warning' | 'primary' | 'success' | 'info' }> = {
  pending: { label: '待受理', type: 'warning' },
  processing: { label: '处理中', type: 'primary' },
  resolved: { label: '已解决', type: 'success' },
  closed: { label: '已关闭', type: 'info' },
}

// EP el-tag 各 type 的确切色值(antd Tag 不完全等价,按约定内联对齐)
const EP_TAG_TONES: Record<'primary' | 'success' | 'warning' | 'danger' | 'info', { color: string; background: string; borderColor: string }> = {
  primary: { color: '#c41e1e', background: '#fdecec', borderColor: '#f2b8b8' },
  success: { color: '#67c23a', background: '#f0f9eb', borderColor: '#e1f3d8' },
  warning: { color: '#e6a23c', background: '#fdf6ec', borderColor: '#faecd8' },
  danger: { color: '#f56c6c', background: '#fef0f0', borderColor: '#fde2e2' },
  info: { color: '#909399', background: '#f4f4f5', borderColor: '#e9e9eb' },
}

function EpTag({ tone, children }: { tone: 'primary' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) {
  const toneStyle = EP_TAG_TONES[tone]
  return <Tag style={{ color: toneStyle.color, background: toneStyle.background, borderColor: toneStyle.borderColor }}>{children}</Tag>
}

function getLeaveStatus(status: string) {
  return leaveStatusMap[status as LeaveStatus] ?? leaveStatusMap.pending
}

function getTicketStatus(status: string) {
  return ticketStatusMap[status as TicketStatus] ?? ticketStatusMap.pending
}

function scoreBarWidth(score: number) {
  return `${Math.max(0, Math.min(100, Number(score)))}%`
}

function scoreLevel(score: number) {
  if (Number(score) >= 90) return '优秀'
  if (Number(score) >= 80) return '良好'
  if (Number(score) >= 60) return '合格'
  return '待提升'
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': '1',
        ...(options?.headers ?? {}),
      },
    })
    if (!response.ok) throw new Error('API request failed')
    const body = await response.json() as { code: number; data: T }
    if (body.code !== 200) throw new Error('API returned an error')
    return body.data
  } finally {
    window.clearTimeout(timeout)
  }
}

const lifeArticles = [
  { category: 'medical', title: '英国 NHS 非紧急医疗服务', content: '注册 GP 后可预约常规诊疗；紧急危险情况请拨打 999，非紧急医疗可拨打 111 获取指引。' },
  { category: 'transport', title: '曼彻斯特公共交通出行', content: '市内可使用 contactless 或 Bee Network 相关票卡，出行前请确认末班车时间。' },
  { category: 'emergency', title: '海外紧急求助原则', content: '遇到人身安全、火灾或急救等紧急情况，请优先联系当地官方紧急服务，并联系学校或可信任的人。' },
  { category: 'daily_life', title: '住宿入住检查清单', content: '入住当天拍照记录房屋状态，确认水电煤读数，并保留房东和中介联系方式。' },
]

const programOptions = [
  { name: '英国名校硕博申请规划', category: '学历提升', duration: '6-10个月', description: '选校定位、科研背景评估、文书规划和申请节奏管理。' },
  { name: '科研背景提升计划', category: '背景提升', duration: '3-6个月', description: '匹配科研项目、导师指导和成果展示方案。' },
  { name: '学术英语写作强化营', category: '语言培训', duration: '8周', description: '强化文献阅读、学术写作、引用规范和课堂展示。' },
]

export function StudentPage() {
  const navigate = useNavigate()
  const [usingRemoteData, setUsingRemoteData] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activePanel, setActivePanel] = useState('overview')
  const [focusedDeadlineId, setFocusedDeadlineId] = useState<number | null>(null)
  const [focusedTicketId, setFocusedTicketId] = useState<number | null>(null)
  const [leaveDialogVisible, setLeaveDialogVisible] = useState(false)
  const [ticketDialogVisible, setTicketDialogVisible] = useState(false)
  const [progressDialogVisible, setProgressDialogVisible] = useState(false)
  // Vue 中该弹窗已无入口(入口按钮改为路由跳转),保留其状态与内容,照搬「永不打开」的现状
  const [supportDialogVisible, setSupportDialogVisible] = useState(false)
  const [supportMode, setSupportMode] = useState<SupportMode>('psych')
  const [supportInput, setSupportInput] = useState('')
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantReply, setAssistantReply] = useState(
    '你好，我可以直接为你打开请假、反馈、学业和申请进度服务；心理、海外生活和升学咨询会进入对应的智能对话。',
  )

  const [overview, setOverview] = useState<Overview>({ pending_leaves: 1, open_tickets: 1, upcoming_deadlines: 3, open_psych_alerts: 0 })
  const [leaves, setLeaves] = useState<LeaveItem[]>([
    {
      id: 1001,
      leave_type: '病假',
      start_time: '2026-09-10 08:00',
      end_time: '2026-09-10 18:00',
      reason: '身体不适，申请请假一天。',
      status: 'pending',
    },
  ])
  const [tickets, setTickets] = useState<TicketItem[]>([
    {
      id: 2001,
      ticket_type: '投诉',
      category: '签证办理',
      title: '签证材料反馈较慢',
      content: '希望确认材料审核的预计反馈时间。',
      status: 'processing',
      priority: 'medium',
    },
  ])
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([
    { id: 3001, deadline_type: 'paper', title: '论文选题提交', description: '提交选题确认表至教学平台主管。', deadline: '2026-09-12 17:00', status: 'pending' },
    { id: 3002, deadline_type: 'application', title: '硕士申请材料补充', description: '补充成绩单和推荐信扫描件。', deadline: '2026-09-16 18:00', status: 'pending' },
    { id: 3003, deadline_type: 'visa', title: '签证体检预约', description: '完成指定医院体检预约。', deadline: '2026-09-25 12:00', status: 'pending' },
  ])
  const [scores, setScores] = useState<ScoreItem[]>([])
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [progressList, setProgressList] = useState<ProgressItem[]>([
    {
      id: 4001,
      target_school: '曼彻斯特大学',
      target_major: '教育学硕士',
      stage: 'under_review',
      progress_detail: '院校已确认收到完整申请材料，正在审核。',
      deadline: '2026-10-08',
      next_action: '等待审核结果，如收到补件通知请在 3 个工作日内反馈顾问。',
    },
    {
      id: 4002,
      target_school: '格拉斯哥大学',
      target_major: '教育学硕士',
      stage: 'document_prep',
      progress_detail: '个人陈述正在进行第二轮修改。',
      deadline: '2026-09-18',
      next_action: '确认个人陈述终稿并补充推荐人联系方式。',
    },
  ])

  const [leaveForm, setLeaveForm] = useState<{ leave_type: string; range: [Dayjs, Dayjs] | null; reason: string; attachment_url: string }>({
    leave_type: 'sick',
    range: null,
    reason: '',
    attachment_url: '',
  })
  const [ticketForm, setTicketForm] = useState<{ ticket_type: string; category: string; title: string; detail: string; priority: string }>({
    ticket_type: 'complaint',
    category: '签证办理',
    title: '',
    detail: '',
    priority: 'medium',
  })
  const [progressForm, setProgressForm] = useState<{ target_school: string; target_major: string; progress_detail: string; deadline: Dayjs | null; next_action: string }>({
    target_school: '',
    target_major: '',
    progress_detail: '',
    deadline: null,
    next_action: '',
  })
  const [psychMessages, setPsychMessages] = useState<PsychMessage[]>([
    { role: 'assistant', content: '你好，我会认真倾听你的感受。你可以说说最近让你困扰的事情。' },
  ])
  const [lifeCategory, setLifeCategory] = useState('medical')

  // 等价 Vue computed
  const nearestDeadline = deadlines[0]
  const openTicket = tickets.find((item) => item.status === 'processing' || item.status === 'pending')
  const courseOptions = [...new Set(scores.map((item) => item.course_name))]
  const displayedScores = selectedCourse === 'all' ? scores : scores.filter((item) => item.course_name === selectedCourse)
  const scoreAverage = displayedScores.length
    ? displayedScores.reduce((total, item) => total + Number(item.score), 0) / displayedScores.length
    : 0
  const totalCredits = displayedScores.reduce((total, item) => total + Number(item.credit ?? 0), 0)
  const supportTitle = ({ psych: '心理关怀', life: '海外生活支持', program: '升学项目咨询' })[supportMode]
  const visibleLifeArticles = lifeArticles.filter((item) => item.category === lifeCategory)

  const loadRemoteData = async () => {
    setLoading(true)
    try {
      const [remoteOverview, remoteLeaves, remoteTickets, remoteDeadlines, remoteScores, remoteProgress] = await Promise.all([
        request<Overview>('/overview'),
        request<LeaveItem[]>('/leaves'),
        request<TicketItem[]>('/tickets'),
        request<DeadlineItem[]>('/academic/deadlines'),
        request<ScoreItem[]>('/academic/scores?all_students=true'),
        request<ProgressItem[]>('/application-progress'),
      ])
      setOverview(remoteOverview)
      setLeaves(remoteLeaves)
      setTickets(remoteTickets)
      setDeadlines(remoteDeadlines)
      setScores(remoteScores)
      setProgressList(remoteProgress)
      setUsingRemoteData(true)
    } catch {
      setUsingRemoteData(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRemoteData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openLeaveDialog = () => {
    setLeaveDialogVisible(true)
  }

  const openTicketDialog = () => {
    setTicketDialogVisible(true)
  }

  const focusDeadline = (item: DeadlineItem) => {
    setActivePanel('academic')
    setFocusedDeadlineId(item.id)
  }

  const focusTicket = (item: TicketItem) => {
    setActivePanel('ticket')
    setFocusedTicketId(item.id)
  }

  const openSupport = (mode: SupportMode) => {
    const routeByMode: Record<SupportMode, string> = {
      psych: '/student/psych',
      life: '/student/life',
      program: '/student/program',
    }
    void navigate(routeByMode[mode])
  }

  const submitPsychMessage = () => {
    const content = supportInput.trim()
    if (!content) return
    setPsychMessages((prev) => [...prev, { role: 'user', content }])
    const highRisk = /不想活|自杀|伤害自己|撑不住|结束生命/.test(content)
    if (highRisk) {
      setOverview((prev) => ({ ...prev, open_psych_alerts: Math.max(1, prev.open_psych_alerts) }))
      setPsychMessages((prev) => [...prev, { role: 'assistant', content: '谢谢你愿意告诉我。你现在的安全最重要，请立刻联系身边可信任的人、学校老师或当地紧急支持服务。我已为你标记人工关怀跟进。' }])
      toast.warning('已标记为需要人工关怀跟进')
    } else {
      setPsychMessages((prev) => [...prev, { role: 'assistant', content: '我听到了你的感受。你不需要一个人承担这些压力，我们可以一起把当前最困扰你的事情拆成更小的一步。' }])
    }
    setSupportInput('')
  }

  const submitLeave = async () => {
    if (!leaveForm.range || leaveForm.range.length !== 2 || !leaveForm.reason.trim()) {
      toast.warning('请补充请假时间和事由')
      return
    }
    // 照搬 Vue value-format="YYYY-MM-DDTHH:mm:ss"(antd 用 dayjs 对象,提交时手写 format)
    const payload = {
      leave_type: leaveForm.leave_type,
      start_time: leaveForm.range[0].format('YYYY-MM-DDTHH:mm:ss'),
      end_time: leaveForm.range[1].format('YYYY-MM-DDTHH:mm:ss'),
      reason: leaveForm.reason.trim(),
      attachment_url: leaveForm.attachment_url || undefined,
    }
    let result: LeaveItem
    try {
      result = await request<LeaveItem>('/leaves', { method: 'POST', body: JSON.stringify(payload) })
    } catch {
      toast.error('请假申请提交失败，请检查后端连接后重试')
      return
    }
    setLeaves((prev) => [result, ...prev])
    setUsingRemoteData(true)
    setOverview((prev) => ({ ...prev, pending_leaves: prev.pending_leaves + 1 }))
    setLeaveDialogVisible(false)
    setLeaveForm({ leave_type: 'sick', range: null, reason: '', attachment_url: '' })
    toast.success('请假申请已提交，等待班主任审批')
  }

  const submitTicket = async () => {
    if (!ticketForm.title.trim() || !ticketForm.detail.trim()) {
      toast.warning('请填写反馈标题和详细说明')
      return
    }
    const payload = {
      ...ticketForm,
      content: ticketForm.detail.trim().slice(0, 120),
      detail: ticketForm.detail.trim(),
    }
    let result: TicketItem
    try {
      result = await request<TicketItem>('/tickets', { method: 'POST', body: JSON.stringify(payload) })
    } catch {
      toast.error('反馈工单提交失败，请检查后端连接后重试')
      return
    }
    setTickets((prev) => [result, ...prev])
    setUsingRemoteData(true)
    setOverview((prev) => ({ ...prev, open_tickets: prev.open_tickets + 1 }))
    setTicketDialogVisible(false)
    setTicketForm({ ticket_type: 'complaint', category: '签证办理', title: '', detail: '', priority: 'medium' })
    toast.success('反馈工单已提交，工作人员会尽快处理')
  }

  const submitProgress = async () => {
    if (!progressForm.target_school.trim()) {
      toast.warning('请填写目标院校')
      return
    }
    try {
      const result = await request<ProgressItem>('/application-progress', {
        method: 'POST',
        // 与 Vue 一致:value-format YYYY-MM-DD,空值传 undefined(JSON 序列化时剔除)
        body: JSON.stringify({
          ...progressForm,
          deadline: progressForm.deadline ? progressForm.deadline.format('YYYY-MM-DD') : undefined,
        }),
      })
      setProgressList((prev) => [result, ...prev])
      setProgressDialogVisible(false)
      setProgressForm({ target_school: '', target_major: '', progress_detail: '', deadline: null, next_action: '' })
      toast.success('申请进度已提交，等待顾问处理')
    } catch {
      toast.error('申请提交失败，请检查后端连接后重试')
    }
  }

  const handleAssistantRequest = async (rawInput: string) => {
    const content = rawInput.trim()
    if (!content) return
    const normalized = content.toLowerCase()
    setAssistantInput('')

    if (/请假|病假|事假|紧急假/.test(normalized)) {
      setAssistantReply('已为你打开请假申请。请补充请假类型、时间和事由后提交。')
      setLeaveDialogVisible(true)
      return
    }
    if (/投诉|反馈|建议|工单/.test(normalized)) {
      setAssistantReply('已为你打开投诉反馈表单。填写问题标题和详细说明后即可提交工单。')
      setTicketDialogVisible(true)
      return
    }
    if (/申请进度|院校审核|签证进度|材料进度/.test(normalized)) {
      setActivePanel('progress')
      setAssistantReply('已切换到申请进度，可查看院校、材料、签证等当前办理阶段。')
      return
    }
    if (/论文|ddl|成绩|考试|学业/.test(normalized)) {
      setActivePanel('academic')
      setAssistantReply(`已切换到学业考务。最近节点是“${nearestDeadline?.title ?? '暂无待办'}”，截止时间为 ${nearestDeadline?.deadline ?? '暂无'}。`)
      return
    }
    if (/压力|焦虑|难过|失眠|心理|倾诉/.test(normalized)) {
      setAssistantReply('正在进入心理关怀智能对话。')
      await navigate('/student/psych')
      return
    }
    if (/海外|英国|医疗|交通|住宿|生活/.test(normalized)) {
      setAssistantReply('正在进入海外生活支持智能对话。')
      await navigate('/student/life')
      return
    }
    if (/升学|硕博|科研|语言|项目咨询/.test(normalized)) {
      setAssistantReply('正在进入学业提升咨询智能对话。')
      await navigate('/student/program')
      return
    }

    setAssistantReply('我暂时未识别到具体办理事项。你可以直接说“我想请假”“查看申请进度”“查询论文 DDL”，或进入心理、生活、升学智能对话。')
  }

  const askAssistant = (prompt: string) => {
    void handleAssistantRequest(prompt)
  }

  const sendAssistantMessage = () => {
    void handleAssistantRequest(assistantInput)
  }

  const leaveColumns: TableProps<LeaveItem>['columns'] = [
    { title: '申请人', width: 150, render: () => `${currentStudent.name}（${currentStudent.studentNo}）` },
    { title: '类型', dataIndex: 'leave_type', width: 110 },
    { title: '开始时间', dataIndex: 'start_time', width: 160 },
    { title: '结束时间', dataIndex: 'end_time', width: 160 },
    { title: '事由', dataIndex: 'reason', ellipsis: true },
    {
      title: '状态',
      width: 110,
      render: (_, record) => {
        const status = getLeaveStatus(record.status)
        return <EpTag tone={status.type}>{status.label}</EpTag>
      },
    },
  ]

  const ticketColumns: TableProps<TicketItem>['columns'] = [
    { title: '工单标题', dataIndex: 'title' },
    { title: '分类', dataIndex: 'category', width: 120 },
    { title: '优先级', dataIndex: 'priority', width: 100 },
    {
      title: '状态',
      width: 110,
      render: (_, record) => {
        const status = getTicketStatus(record.status)
        return <EpTag tone={status.type}>{status.label}</EpTag>
      },
    },
    {
      title: '处理方案',
      dataIndex: 'solution',
      render: (_, record) => record.solution || '处理中，暂未结案',
    },
  ]

  const deadlineColumns: TableProps<DeadlineItem>['columns'] = [
    { title: '事项', dataIndex: 'title' },
    { title: '截止时间', dataIndex: 'deadline', width: 160 },
    { title: '类型', dataIndex: 'deadline_type', width: 110 },
  ]

  // el-table stripe:偶数行(index % 2 === 1)底色
  const stripeRowClass = (_record: unknown, index: number) => (index % 2 === 1 ? 'ep-stripe-row' : '')

  const leaveRowClass = (record: LeaveItem, index: number) => stripeRowClass(record, index)

  const ticketRowClass = (record: TicketItem, index: number) =>
    [record.id === focusedTicketId ? 'focused-row' : '', stripeRowClass(record, index)].filter(Boolean).join(' ')

  const deadlineRowClass = (record: DeadlineItem) => (record.id === focusedDeadlineId ? 'focused-row' : '')

  return (
    <section className="student-page">
      <Spin spinning={loading}>
        <header className="page-heading">
          <div>
            <p className="eyebrow">STUDENT SERVICE CENTER</p>
            <h1>学生智能助手</h1>
            <p>学习、申请与生活服务统一入口</p>
          </div>
          <div className={usingRemoteData ? 'data-state remote' : 'data-state'}>
            <span className="state-dot" />
            {usingRemoteData ? '已连接业务服务' : '演示数据模式'}
          </div>
        </header>

        <div className="metrics-grid">
          <button type="button" className="metric-card" onClick={() => setActivePanel('leave')}>
            <i className="el-icon metric-icon leave"><Calendar /></i>
            <span>待审批请假</span>
            <strong>{overview.pending_leaves}</strong>
            <small>查看申请状态</small>
          </button>
          <button type="button" className="metric-card" onClick={() => setActivePanel('ticket')}>
            <i className="el-icon metric-icon ticket"><Service /></i>
            <span>处理中工单</span>
            <strong>{overview.open_tickets}</strong>
            <small>跟进服务反馈</small>
          </button>
          <button type="button" className="metric-card" onClick={() => setActivePanel('academic')}>
            <i className="el-icon metric-icon deadline"><Timer /></i>
            <span>临近关键节点</span>
            <strong>{overview.upcoming_deadlines}</strong>
            <small>论文、申请与签证</small>
          </button>
          <button type="button" className="metric-card" onClick={() => setActivePanel('care')}>
            <i className="el-icon metric-icon care"><ChatDotRound /></i>
            <span>心理关怀状态</span>
            <strong>{overview.open_psych_alerts ? '需跟进' : '正常'}</strong>
            <small>需要时可随时倾诉</small>
          </button>
        </div>

        <div className="workbench-grid">
          <section className="assistant-panel" aria-label="学生助手对话">
            <div className="assistant-title">
              <div className="assistant-mark"><i className="el-icon"><ChatDotRound /></i></div>
              <div>
                <h2>我能帮你处理什么？</h2>
                <p>直接告诉我你的问题或要办理的事项</p>
              </div>
            </div>
            <div className="assistant-reply">{assistantReply}</div>
            <div className="quick-prompts">
              <button type="button" onClick={() => askAssistant('我想请假')}>我想请假</button>
              <button type="button" onClick={() => askAssistant('查看申请进度')}>查看申请进度</button>
              <button type="button" onClick={() => askAssistant('查询论文 DDL')}>查询论文 DDL</button>
              <button type="button" onClick={() => askAssistant('最近压力很大')}>最近压力很大</button>
            </div>
            <div className="assistant-input">
              <Input
                value={assistantInput}
                placeholder="例如：帮我查一下签证材料进度"
                onChange={(event) => setAssistantInput(event.target.value)}
                onKeyDown={(event) => {
                  // IME 组合期不触发发送(与 Vue keyup.enter 语义差异按约定加守卫)
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    sendAssistantMessage()
                  }
                }}
              />
              <Button type="primary" shape="circle" icon={<Promotion />} aria-label="发送" onClick={sendAssistantMessage} />
            </div>
          </section>

          <section className="attention-panel" aria-label="近期提醒">
            <div className="section-title">
              <div>
                <p>近期提醒</p>
                <h2>优先处理</h2>
              </div>
              <i className="el-icon"><Warning /></i>
            </div>
            {nearestDeadline ? (
              <button type="button" className="attention-item deadline-item" onClick={() => focusDeadline(nearestDeadline)}>
                <span className="attention-time">{nearestDeadline.deadline.slice(5, 10)}</span>
                <div>
                  <strong>{nearestDeadline.title}</strong>
                  <p>{nearestDeadline.description}</p>
                </div>
                <span className="attention-action">查看详情</span>
              </button>
            ) : null}
            {openTicket ? (
              <button type="button" className="attention-item" onClick={() => focusTicket(openTicket)}>
                <span className="attention-time neutral">工单</span>
                <div>
                  <strong>{openTicket.title}</strong>
                  <p>当前状态：{getTicketStatus(openTicket.status).label}</p>
                </div>
                <span className="attention-action">跟进工单</span>
              </button>
            ) : null}
          </section>
        </div>

        <section className="service-section">
          <Tabs
            activeKey={activePanel}
            onChange={(key) => setActivePanel(key)}
            className="student-tabs"
            items={[
              {
                key: 'overview',
                label: '我的服务',
                children: (
                  <div className="service-grid">
                    <button type="button" className="service-card" onClick={openLeaveDialog}>
                      <i className="el-icon"><Calendar /></i>
                      <div><strong>请假申请</strong><span>提交、撤销与查看审批结果</span></div>
                    </button>
                    <button type="button" className="service-card" onClick={openTicketDialog}>
                      <i className="el-icon"><DocumentChecked /></i>
                      <div><strong>投诉反馈</strong><span>提交服务意见并追踪处理</span></div>
                    </button>
                    <button type="button" className="service-card" onClick={() => setActivePanel('academic')}>
                      <i className="el-icon"><Reading /></i>
                      <div><strong>学业考务</strong><span>查询成绩、考试与关键 DDL</span></div>
                    </button>
                    <button type="button" className="service-card" onClick={() => setActivePanel('progress')}>
                      <i className="el-icon"><School /></i>
                      <div><strong>申请进度</strong><span>掌握院校申请与签证节点</span></div>
                    </button>
                  </div>
                ),
              },
              {
                key: 'leave',
                label: '请假记录',
                children: (
                  <>
                    <div className="panel-toolbar">
                      <p>提交后将自动通知班主任审批。</p>
                      <Button type="primary" icon={<Calendar />} onClick={openLeaveDialog}>发起请假</Button>
                    </div>
                    <Table<LeaveItem>
                      rowKey="id"
                      columns={leaveColumns}
                      dataSource={leaves}
                      pagination={false}
                      rowClassName={leaveRowClass}
                    />
                  </>
                ),
              },
              {
                key: 'ticket',
                label: '投诉反馈',
                children: (
                  <>
                    <div className="panel-toolbar">
                      <p>工作人员处理后会在这里同步解决方案。</p>
                      <Button type="primary" icon={<DocumentChecked />} onClick={openTicketDialog}>提交反馈</Button>
                    </div>
                    <Table<TicketItem>
                      rowKey="id"
                      columns={ticketColumns}
                      dataSource={tickets}
                      pagination={false}
                      rowClassName={ticketRowClass}
                    />
                  </>
                ),
              },
              {
                key: 'academic',
                label: '学业考务',
                children: (
                  <div className="academic-layout">
                    <div>
                      <h3>关键节点</h3>
                      <Table<DeadlineItem>
                        rowKey="id"
                        size="small"
                        columns={deadlineColumns}
                        dataSource={deadlines}
                        pagination={false}
                        rowClassName={deadlineRowClass}
                      />
                    </div>
                    <div className="score-panel">
                      <div className="score-panel-header">
                        <div>
                          <h3>课程成绩</h3>
                          <span>{displayedScores[0]?.semester || scores[0]?.semester || '暂无学期信息'} · 数据库共 {scores.length} 条</span>
                        </div>
                        <i className="el-icon"><CircleCheck /></i>
                      </div>
                      <Select
                        className="course-filter"
                        aria-label="按科目筛选成绩"
                        value={selectedCourse}
                        onChange={(value) => setSelectedCourse(value)}
                        options={[
                          { label: '全部科目', value: 'all' },
                          ...courseOptions.map((course) => ({ label: course, value: course })),
                        ]}
                      />
                      {displayedScores.length ? (
                        <>
                          <div className="score-summary">
                            <div><span>平均成绩</span><strong>{scoreAverage.toFixed(1)}</strong></div>
                            <div><span>已获学分</span><strong>{totalCredits.toFixed(1)}</strong></div>
                            <div><span>展示科目</span><strong>{displayedScores.length}</strong></div>
                          </div>
                          <div className="score-bars">
                            {displayedScores.map((item) => (
                              <div key={item.id} className="score-row">
                                <div className="score-course">
                                  <strong>{item.course_name}</strong>
                                  <span>学生 {item.student_id} · {item.credit ?? 0} 学分 · {scoreLevel(item.score)}</span>
                                </div>
                                <div className="score-track"><i style={{ width: scoreBarWidth(item.score) }} /></div>
                                <b>{Number(item.score).toFixed(1)}</b>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <Empty description="暂无成绩数据" styles={{ image: { height: 54 } }} />
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: 'progress',
                label: '申请进度',
                children: (
                  <>
                    <div className="panel-toolbar">
                      <p>顾问处理后会同步更新申请阶段和下一步安排。</p>
                      <Button type="primary" icon={<School />} onClick={() => setProgressDialogVisible(true)}>发起申请</Button>
                    </div>
                    <div className="progress-list">
                      {progressList.map((item) => (
                        <article key={item.id} className="progress-card">
                          <div className="progress-stage">{stageLabel[item.stage] || item.stage}</div>
                          <div>
                            <h3>{item.target_school}</h3>
                            <p>{item.target_major}</p>
                          </div>
                          <p className="progress-detail">{item.progress_detail}</p>
                          <div className="progress-next"><span>下一步</span><strong>{item.next_action}</strong></div>
                        </article>
                      ))}
                    </div>
                  </>
                ),
              },
              {
                key: 'care',
                label: '生活与关怀',
                children: (
                  <div className="care-grid">
                    <article>
                      <i className="el-icon"><ChatDotRound /></i>
                      <h3>心理关怀</h3>
                      <p>情绪倾诉会被谨慎记录；出现高风险信号时，仅向负责老师发出人工跟进提醒。</p>
                      <Button color="primary" variant="text" onClick={() => openSupport('psych')}>开始倾诉</Button>
                    </article>
                    <article>
                      <i className="el-icon"><Service /></i>
                      <h3>海外生活支持</h3>
                      <p>可查询当地医疗、交通、紧急求助和日常生活信息，正式版本将按留学国家检索知识库。</p>
                      <Button color="primary" variant="text" onClick={() => openSupport('life')}>查询生活支持</Button>
                    </article>
                    <article>
                      <i className="el-icon"><School /></i>
                      <h3>升学项目咨询</h3>
                      <p>根据申请阶段和明确意向，匹配语言、背景提升或学历提升项目。</p>
                      <Button color="primary" variant="text" onClick={() => openSupport('program')}>咨询项目</Button>
                    </article>
                  </div>
                ),
              },
            ]}
          />
        </section>

        {/* 心理/生活/升学支持弹窗:Vue 中入口已改为路由跳转,此弹窗保留但无入口,照搬现状 */}
        <Modal
          open={supportDialogVisible}
          title={supportTitle}
          width={600}
          onCancel={() => setSupportDialogVisible(false)}
          onOk={() => setSupportDialogVisible(false)}
        >
          {supportMode === 'psych' ? (
            <>
              <div className="psych-dialog">
                {psychMessages.map((message, index) => (
                  <div key={index} className={`psych-message ${message.role}`}>{message.content}</div>
                ))}
              </div>
              <div className="psych-input">
                <Input.TextArea
                  rows={3}
                  placeholder="写下你现在的感受"
                  value={supportInput}
                  onChange={(event) => setSupportInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.ctrlKey && event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      submitPsychMessage()
                    }
                  }}
                />
                <Button type="primary" onClick={submitPsychMessage}>发送</Button>
              </div>
            </>
          ) : supportMode === 'life' ? (
            <>
              <Radio.Group
                className="life-category"
                value={lifeCategory}
                onChange={(event) => setLifeCategory(event.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="medical">医疗</Radio.Button>
                <Radio.Button value="transport">交通</Radio.Button>
                <Radio.Button value="emergency">紧急求助</Radio.Button>
                <Radio.Button value="daily_life">日常生活</Radio.Button>
              </Radio.Group>
              <div className="life-articles">
                {visibleLifeArticles.map((item) => (
                  <article key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.content}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="program-list">
              {programOptions.map((item) => (
                <article key={item.name}>
                  <div>
                    <Tag>{item.category}</Tag>
                    <h3>{item.name}</h3>
                  </div>
                  <span>{item.duration}</span>
                  <p>{item.description}</p>
                  <Button color="primary" variant="text" onClick={() => toast.success('咨询意向已记录，顾问将与你联系')}>咨询此项目</Button>
                </article>
              ))}
            </div>
          )}
        </Modal>

        <Modal
          open={leaveDialogVisible}
          title="发起请假申请"
          width={520}
          destroyOnHidden
          onCancel={() => setLeaveDialogVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setLeaveDialogVisible(false)}>取消</Button>,
            <Button key="submit" type="primary" onClick={() => void submitLeave()}>确认提交</Button>,
          ]}
        >
          <div className="applicant-note">
            <span>当前申请人</span>
            <strong>{currentStudent.name}（{currentStudent.studentNo}）</strong>
            <small>{currentStudent.school}</small>
          </div>
          <div className="student-form-item">
            <label>请假类型</label>
            <Radio.Group
              value={leaveForm.leave_type}
              onChange={(event) => setLeaveForm((prev) => ({ ...prev, leave_type: event.target.value }))}
              buttonStyle="solid"
            >
              <Radio.Button value="sick">病假</Radio.Button>
              <Radio.Button value="personal">事假</Radio.Button>
              <Radio.Button value="emergency">紧急请假</Radio.Button>
            </Radio.Group>
          </div>
          <div className="student-form-item">
            <label>请假时间</label>
            <DatePicker.RangePicker
              showTime
              style={{ width: '100%' }}
              value={leaveForm.range}
              placeholder={['开始时间', '结束时间']}
              onChange={(dates) => setLeaveForm((prev) => ({
                ...prev,
                range: dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null,
              }))}
            />
          </div>
          <div className="student-form-item">
            <label>请假事由</label>
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              value={leaveForm.reason}
              onChange={(event) => setLeaveForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
          </div>
          <div className="student-form-item">
            <label>附件链接（可选）</label>
            <Input
              placeholder="病假证明等附件地址"
              value={leaveForm.attachment_url}
              onChange={(event) => setLeaveForm((prev) => ({ ...prev, attachment_url: event.target.value }))}
            />
          </div>
        </Modal>

        <Modal
          open={ticketDialogVisible}
          title="提交投诉反馈"
          width={560}
          destroyOnHidden
          onCancel={() => setTicketDialogVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setTicketDialogVisible(false)}>取消</Button>,
            <Button key="submit" type="primary" onClick={() => void submitTicket()}>提交工单</Button>,
          ]}
        >
          <div className="student-form-item">
            <label>反馈类型</label>
            <Radio.Group
              value={ticketForm.ticket_type}
              onChange={(event) => setTicketForm((prev) => ({ ...prev, ticket_type: event.target.value }))}
              buttonStyle="solid"
            >
              <Radio.Button value="complaint">投诉</Radio.Button>
              <Radio.Button value="suggestion">建议</Radio.Button>
              <Radio.Button value="consult">咨询</Radio.Button>
            </Radio.Group>
          </div>
          <div className="student-form-cols">
            <div className="student-form-item">
              <label>问题分类</label>
              <Select
                style={{ width: '100%' }}
                value={ticketForm.category}
                onChange={(value) => setTicketForm((prev) => ({ ...prev, category: value }))}
                options={[
                  { label: '签证办理', value: '签证办理' },
                  { label: '院校申请', value: '院校申请' },
                  { label: '生活服务', value: '生活服务' },
                  { label: '其他', value: '其他' },
                ]}
              />
            </div>
            <div className="student-form-item">
              <label>优先级</label>
              <Select
                style={{ width: '100%' }}
                value={ticketForm.priority}
                onChange={(value) => setTicketForm((prev) => ({ ...prev, priority: value }))}
                options={[
                  { label: '低', value: 'low' },
                  { label: '中', value: 'medium' },
                  { label: '高', value: 'high' },
                  { label: '紧急', value: 'urgent' },
                ]}
              />
            </div>
          </div>
          <div className="student-form-item">
            <label>标题</label>
            <Input
              maxLength={80}
              showCount
              value={ticketForm.title}
              onChange={(event) => setTicketForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>
          <div className="student-form-item">
            <label>详细说明</label>
            <Input.TextArea
              rows={5}
              maxLength={2000}
              showCount
              value={ticketForm.detail}
              onChange={(event) => setTicketForm((prev) => ({ ...prev, detail: event.target.value }))}
            />
          </div>
        </Modal>

        <Modal
          open={progressDialogVisible}
          title="发起申请进度"
          width={560}
          destroyOnHidden
          onCancel={() => setProgressDialogVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setProgressDialogVisible(false)}>取消</Button>,
            <Button key="submit" type="primary" onClick={() => void submitProgress()}>提交申请</Button>,
          ]}
        >
          <div className="student-form-item">
            <label>目标院校</label>
            <Input
              value={progressForm.target_school}
              onChange={(event) => setProgressForm((prev) => ({ ...prev, target_school: event.target.value }))}
            />
          </div>
          <div className="student-form-item">
            <label>目标专业</label>
            <Input
              value={progressForm.target_major}
              onChange={(event) => setProgressForm((prev) => ({ ...prev, target_major: event.target.value }))}
            />
          </div>
          <div className="student-form-item">
            <label>申请说明</label>
            <Input.TextArea
              rows={3}
              value={progressForm.progress_detail}
              onChange={(event) => setProgressForm((prev) => ({ ...prev, progress_detail: event.target.value }))}
            />
          </div>
          <div className="student-form-item">
            <label>期望截止日期</label>
            <DatePicker
              style={{ width: '100%' }}
              value={progressForm.deadline}
              onChange={(date) => setProgressForm((prev) => ({ ...prev, deadline: date }))}
            />
          </div>
          <div className="student-form-item">
            <label>下一步安排</label>
            <Input
              value={progressForm.next_action}
              onChange={(event) => setProgressForm((prev) => ({ ...prev, next_action: event.target.value }))}
            />
          </div>
        </Modal>
      </Spin>
    </section>
  )
}
