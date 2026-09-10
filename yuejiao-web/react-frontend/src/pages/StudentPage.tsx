import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  ClipboardList,
  GraduationCap,
  HeartPulse,
  LifeBuoy,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  createLeave,
  createProgress,
  createTicket,
  fetchDeadlines,
  fetchKnowledge,
  fetchLeaves,
  fetchOverview,
  fetchProgress,
  fetchPsychProfile,
  fetchScores,
  fetchStudents,
  fetchTickets,
  type AcademicDeadline,
  type ApplicationProgress,
  type OverseasKnowledge,
  type PsychProfile,
  type StudentLeave,
  type StudentOverview,
  type StudentScore,
  type StudentSummary,
  type StudentTicket,
} from '@/api/student'
import { useAuthStore } from '@/store/authStore'
import { Badge, Button, Empty, Field, Input, Modal, PageHeader, Panel, Select, StatCard, Tabs, Textarea, type TabItem } from '@/ui'
import { showToast } from '@/ui/toast'
import './student.css'

// 学生服务页(gqk 框架版) + 旧版功能移植:
// - mock 降级:api 调用失败/超时(10s)回退内置演示数据,顶部「演示数据模式 / 已连接业务服务」Badge
// - 4 张可点 KPI 卡联动 Tab,心理关怀卡显示「需跟进/正常」
// - 智能助手面板:正则意图路由(请假/工单/进度/学业/心理/生活/升学),IME 组合期不发送
// - 服务概览快捷卡、学业成绩课程筛选+汇总+分数条、生活与关怀三卡入口

type ServiceTab = 'overview' | 'leaves' | 'tickets' | 'academic' | 'progress' | 'life'
type ModalType = 'leave' | 'ticket' | 'progress' | null

interface StudentData {
  overview: StudentOverview
  leaves: StudentLeave[]
  tickets: StudentTicket[]
  deadlines: AcademicDeadline[]
  scores: StudentScore[]
  progress: ApplicationProgress[]
  psych: PsychProfile | null
  knowledge: OverseasKnowledge[]
}

const EMPTY_DATA: StudentData = {
  overview: { pending_leaves: 0, open_tickets: 0, upcoming_deadlines: 0, open_psych_alerts: 0 },
  leaves: [],
  tickets: [],
  deadlines: [],
  scores: [],
  progress: [],
  psych: null,
  knowledge: [],
}

// 后端不可达时的演示数据(照搬旧版 StudentPage 内置数据)
const DEMO_STUDENT: StudentSummary = {
  id: 1,
  user_id: 1,
  student_no: 'YJ2026001',
  name: '张明',
  real_name: '张明',
  school: '曼彻斯特大学',
  major: '教育学',
  grade: '研一',
  abroad_country: '英国',
  class_teacher_id: null,
}

const DEMO_DATA: StudentData = {
  overview: { pending_leaves: 1, open_tickets: 1, upcoming_deadlines: 3, open_psych_alerts: 0 },
  leaves: [
    {
      id: 1001,
      leave_type: '病假',
      start_time: '2026-09-10 08:00',
      end_time: '2026-09-10 18:00',
      reason: '身体不适，申请请假一天。',
      status: 'pending',
    },
  ],
  tickets: [
    {
      id: 2001,
      ticket_type: '投诉',
      category: '签证办理',
      title: '签证材料反馈较慢',
      content: '希望确认材料审核的预计反馈时间。',
      status: 'processing',
      priority: 'medium',
    },
  ],
  deadlines: [
    { id: 3001, deadline_type: 'paper', title: '论文选题提交', description: '提交选题确认表至教学平台主管。', deadline: '2026-09-12 17:00', status: 'pending' },
    { id: 3002, deadline_type: 'application', title: '硕士申请材料补充', description: '补充成绩单和推荐信扫描件。', deadline: '2026-09-16 18:00', status: 'pending' },
    { id: 3003, deadline_type: 'visa', title: '签证体检预约', description: '完成指定医院体检预约。', deadline: '2026-09-25 12:00', status: 'pending' },
  ],
  scores: [],
  progress: [
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
  ],
  psych: null,
  knowledge: [
    { id: 5001, country: '英国', category: '医疗', title: '英国 NHS 非紧急医疗服务', content: '注册 GP 后可预约常规诊疗；紧急危险情况请拨打 999，非紧急医疗可拨打 111 获取指引。' },
    { id: 5002, country: '英国', category: '交通', title: '曼彻斯特公共交通出行', content: '市内可使用 contactless 或 Bee Network 相关票卡，出行前请确认末班车时间。' },
    { id: 5003, country: '英国', category: '紧急求助', title: '海外紧急求助原则', content: '遇到人身安全、火灾或急救等紧急情况，请优先联系当地官方紧急服务，并联系学校或可信任的人。' },
    { id: 5004, country: '英国', category: '日常生活', title: '住宿入住检查清单', content: '入住当天拍照记录房屋状态，确认水电煤读数，并保留房东和中介联系方式。' },
  ],
}

const tabs: TabItem<ServiceTab>[] = [
  { key: 'overview', label: '服务概览' },
  { key: 'leaves', label: '请假记录' },
  { key: 'tickets', label: '反馈工单' },
  { key: 'academic', label: '学业考务' },
  { key: 'progress', label: '申请进度' },
  { key: 'life', label: '海外生活' },
]

const leaveLabels: Record<string, string> = { sick: '病假', personal: '事假', emergency: '紧急假' }
const statusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已撤销',
  resolved: '已解决',
  closed: '已关闭',
  done: '已完成',
  reminded: '已提醒',
  submitted: '已提交',
  document_prep: '材料准备',
  under_review: '审核中',
  offer_received: '已获录取',
  visa_processing: '签证办理',
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', withTime
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function labelFor(value: string | null | undefined) {
  return value ? statusLabels[value] || value : '—'
}

function toneFor(value: string | null | undefined): 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet' {
  if (value === 'approved' || value === 'resolved' || value === 'done' || value === 'offer_received') return 'success'
  if (value === 'rejected' || value === 'cancelled' || value === 'closed') return 'neutral'
  if (value === 'processing' || value === 'reminded' || value === 'under_review') return 'info'
  if (value === 'urgent' || value === 'high') return 'danger'
  if (value === 'medium' || value === 'pending') return 'warning'
  return 'neutral'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '数据加载失败，请稍后重试'
}

// 等价旧版 10s AbortController:每个请求独立超时,超时按失败处理并触发演示数据降级
function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('请求超时')), ms)
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value) },
      (error) => { window.clearTimeout(timer); reject(error) },
    )
  })
}

function scoreBarWidth(score: number | string) {
  return `${Math.max(0, Math.min(100, Number(score)))}%`
}

function scoreLevel(score: number | string) {
  if (Number(score) >= 90) return '优秀'
  if (Number(score) >= 80) return '良好'
  if (Number(score) >= 60) return '合格'
  return '待提升'
}

export function StudentPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isStudent = user?.user_type === 'student' || user?.role_code === 'student'
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [studentError, setStudentError] = useState('')
  const [data, setData] = useState<StudentData | null>(null)
  const [dataError, setDataError] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [usingRemoteData, setUsingRemoteData] = useState(true)
  const [tab, setTab] = useState<ServiceTab>('overview')
  const [modal, setModal] = useState<ModalType>(null)
  const [submitting, setSubmitting] = useState(false)
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantReply, setAssistantReply] = useState(
    '你好，我可以直接为你打开请假、反馈、学业和申请进度服务；心理、海外生活和升学咨询会进入对应的智能对话。',
  )
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'personal', start_time: '', end_time: '', reason: '', attachment_url: '' })
  const [ticketForm, setTicketForm] = useState({ ticket_type: 'complaint', category: '签证办理', title: '', content: '', detail: '', priority: 'medium' })
  const [progressForm, setProgressForm] = useState({ target_school: '', target_major: '', progress_detail: '', deadline: '', next_action: '' })
  const [scoreCourse, setScoreCourse] = useState('all')

  const selectedStudent = useMemo(
    () => students.find((item) => item.id === selectedId) || null,
    [selectedId, students],
  )

  const reloadStudents = useCallback(async () => {
    setLoadingStudents(true)
    setStudentError('')
    try {
      const items = await withTimeout(fetchStudents())
      setStudents(items)
      setUsingRemoteData(true)
      setSelectedId((current) => {
        if (current && items.some((item) => item.id === current)) return current
        if (isStudent && user?.id && items.some((item) => item.id === user.id)) return user.id
        return items[0]?.id ?? null
      })
    } catch {
      // 降级照搬旧版:静默回退内置演示数据,仅以顶部状态标签提示
      setStudents([DEMO_STUDENT])
      setSelectedId(DEMO_STUDENT.id)
      setUsingRemoteData(false)
      setStudentError('')
    } finally {
      setLoadingStudents(false)
    }
  }, [isStudent, user?.id])

  const loadData = useCallback(async () => {
    if (!selectedId) {
      setData(null)
      return
    }
    setLoadingData(true)
    setDataError('')
    try {
      const [overview, leaves, tickets, deadlines, scores, progress, psych, knowledge] = await Promise.all([
        withTimeout(fetchOverview(selectedId)),
        withTimeout(fetchLeaves(selectedId)),
        withTimeout(fetchTickets(selectedId)),
        withTimeout(fetchDeadlines(selectedId)),
        withTimeout(fetchScores(selectedId)),
        withTimeout(fetchProgress(selectedId)),
        withTimeout(fetchPsychProfile(selectedId)),
        withTimeout(fetchKnowledge(selectedId)),
      ])
      setData({ overview, leaves, tickets, deadlines, scores, progress, psych, knowledge })
      setUsingRemoteData(true)
    } catch {
      // 降级照搬旧版:回退演示数据,保留页面可用
      setData(DEMO_DATA)
      setUsingRemoteData(false)
      setDataError('')
    } finally {
      setLoadingData(false)
    }
  }, [selectedId])

  useEffect(() => { void reloadStudents() }, [reloadStudents])
  useEffect(() => { void loadData() }, [loadData])

  async function refresh() {
    await reloadStudents()
    await loadData()
  }

  function openModal(type: Exclude<ModalType, null>) {
    setModal(type)
  }

  function closeModal() {
    if (!submitting) setModal(null)
  }

  async function submitLeave(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) return
    setSubmitting(true)
    try {
      await createLeave(selectedId, leaveForm)
      setUsingRemoteData(true)
      showToast('请假申请已提交')
      setModal(null)
      setLeaveForm({ leave_type: 'personal', start_time: '', end_time: '', reason: '', attachment_url: '' })
      await loadData()
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitTicket(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) return
    setSubmitting(true)
    try {
      await createTicket(selectedId, ticketForm)
      setUsingRemoteData(true)
      showToast('反馈工单已提交')
      setModal(null)
      setTicketForm({ ticket_type: 'complaint', category: '签证办理', title: '', content: '', detail: '', priority: 'medium' })
      await loadData()
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitProgress(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) return
    setSubmitting(true)
    try {
      await createProgress(selectedId, {
        ...progressForm,
        deadline: progressForm.deadline ? `${progressForm.deadline}T23:59:00` : undefined,
      })
      setUsingRemoteData(true)
      showToast('申请进度已提交')
      setModal(null)
      setProgressForm({ target_school: '', target_major: '', progress_detail: '', deadline: '', next_action: '' })
      await loadData()
    } catch (error) {
      showToast(errorMessage(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function openChat(mode: 'psych' | 'life' | 'program') {
    if (selectedId) navigate(`/student/${mode}?student_id=${selectedId}`)
  }

  // 智能助手:正则意图路由(照搬旧版 handleAssistantRequest)
  function handleAssistantRequest(rawInput: string) {
    const content = rawInput.trim()
    if (!content) return
    const normalized = content.toLowerCase()
    setAssistantInput('')

    if (/请假|病假|事假|紧急假/.test(normalized)) {
      setAssistantReply('已为你打开请假申请。请补充请假类型、时间和事由后提交。')
      setModal('leave')
      return
    }
    if (/投诉|反馈|建议|工单/.test(normalized)) {
      setAssistantReply('已为你打开投诉反馈表单。填写问题标题和详细说明后即可提交工单。')
      setModal('ticket')
      return
    }
    if (/申请进度|院校审核|签证进度|材料进度/.test(normalized)) {
      setTab('progress')
      setAssistantReply('已切换到申请进度，可查看院校、材料、签证等当前办理阶段。')
      return
    }
    if (/论文|ddl|成绩|考试|学业/.test(normalized)) {
      setTab('academic')
      const nearest = currentData.deadlines[0]
      setAssistantReply(`已切换到学业考务。最近节点是“${nearest?.title ?? '暂无待办'}”，截止时间为 ${nearest?.deadline ?? '暂无'}。`)
      return
    }
    if (/压力|焦虑|难过|失眠|心理|倾诉/.test(normalized)) {
      setAssistantReply('正在进入心理关怀智能对话。')
      openChat('psych')
      return
    }
    if (/海外|英国|医疗|交通|住宿|生活/.test(normalized)) {
      setAssistantReply('正在进入海外生活支持智能对话。')
      openChat('life')
      return
    }
    if (/升学|硕博|科研|语言|项目咨询/.test(normalized)) {
      setAssistantReply('正在进入学业提升咨询智能对话。')
      openChat('program')
      return
    }

    setAssistantReply('我暂时未识别到具体办理事项。你可以直接说“我想请假”“查看申请进度”“查询论文 DDL”，或进入心理、生活、升学智能对话。')
  }

  const displayStudent = selectedStudent || (user && isStudent ? {
    id: user.id,
    user_id: user.id,
    student_no: null,
    name: user.real_name,
    real_name: user.real_name,
    school: null,
    major: null,
    grade: null,
    abroad_country: null,
    class_teacher_id: null,
  } satisfies StudentSummary : null)
  const currentData = data || EMPTY_DATA

  const courseOptions = [...new Set(currentData.scores.map((item) => item.course_name))]
  const displayedScores = scoreCourse === 'all' ? currentData.scores : currentData.scores.filter((item) => item.course_name === scoreCourse)
  const scoreAverage = displayedScores.length
    ? displayedScores.reduce((total, item) => total + Number(item.score), 0) / displayedScores.length
    : 0
  const totalCredits = displayedScores.reduce((total, item) => total + Number(item.credit ?? 0), 0)

  function renderOverview() {
    const profile = currentData.psych
    return <div className="student-tab-grid">
      <Panel title="心理关怀摘要" desc="仅展示当前学生的最新画像与风险状态" icon={<HeartPulse size={16} />} actions={<Button size="sm" variant="ghost" icon={<Send size={14} />} onClick={() => openChat('psych')}>进入对话</Button>}>
        {profile ? <div className="student-profile-detail">
          <div><span>情绪标签</span><strong>{profile.latest_emotion_tag || '暂无记录'}</strong></div>
          <div><span>情绪分值</span><strong>{profile.emotion_score ?? '—'}</strong></div>
          <div><span>风险等级</span><Badge tone={profile.risk_level === 'high' ? 'danger' : profile.risk_level === 'medium' ? 'warning' : 'success'}>{profile.risk_level || 'low'}</Badge></div>
          <p>{profile.weekly_summary?.summary || '暂无周摘要。'}</p>
        </div> : <Empty tight title="暂无心理画像" desc="当前学生还没有可展示的心理服务记录。" />}
      </Panel>
      <Panel title="近期学业节点" desc="通用节点与学生专属节点" icon={<CalendarClock size={16} />} actions={<Button size="sm" variant="ghost" onClick={() => setTab('academic')}>查看全部</Button>}>
        {currentData.deadlines.length ? <ul className="student-list">
          {currentData.deadlines.slice(0, 4).map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>{item.description || '—'}</span></div><time>{formatDate(item.deadline, true)}</time></li>)}
        </ul> : <Empty tight title="暂无学业节点" />}
      </Panel>
      <Panel title="申请进度" desc="查看院校申请、材料和签证阶段" icon={<GraduationCap size={16} />} actions={<Button size="sm" variant="ghost" onClick={() => setTab('progress')}>查看全部</Button>}>
        {currentData.progress.length ? <ul className="student-list">
          {currentData.progress.slice(0, 4).map((item) => <li key={item.id}><div><strong>{item.target_school}</strong><span>{item.target_major || '未填写专业'} · {labelFor(item.stage)}</span></div><time>{formatDate(item.deadline)}</time></li>)}
        </ul> : <Empty tight title="暂无申请进度" />}
      </Panel>
      <Panel title="海外生活知识" desc="按学生所在国家筛选的服务内容" icon={<LifeBuoy size={16} />} actions={<Button size="sm" variant="ghost" onClick={() => setTab('life')}>查看全部</Button>}>
        {currentData.knowledge.length ? <ul className="student-list">
          {currentData.knowledge.slice(0, 4).map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>{item.category}</span></div></li>)}
        </ul> : <Empty tight title="暂无海外生活知识" />}
      </Panel>
    </div>
  }

  function renderLeaves() {
    return <Panel flush title="请假记录" desc="学生提交的行政服务申请" icon={<ClipboardList size={16} />} actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openModal('leave')}>提交请假</Button>}>
      {currentData.leaves.length ? <div className="table-wrap"><table className="table"><thead><tr><th>类型</th><th>时间</th><th>事由</th><th>状态</th><th>审批意见</th></tr></thead><tbody>
        {currentData.leaves.map((item) => <tr key={item.id}><td>{leaveLabels[item.leave_type || ''] || item.leave_type || '—'}</td><td>{formatDate(item.start_time, true)}<br />至 {formatDate(item.end_time, true)}</td><td>{item.reason}</td><td><Badge tone={toneFor(item.status)}>{labelFor(item.status)}</Badge></td><td>{item.approval_comment || '—'}</td></tr>)}
      </tbody></table></div> : <Empty title="暂无请假记录" desc="提交后，审批状态会在这里更新。" action={<Button size="sm" variant="primary" onClick={() => openModal('leave')}>提交请假</Button>} />}
    </Panel>
  }

  function renderTickets() {
    return <Panel flush title="反馈工单" desc="投诉、建议和咨询的闭环状态" icon={<MessageCircle size={16} />} actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openModal('ticket')}>新建工单</Button>}>
      {currentData.tickets.length ? <div className="table-wrap"><table className="table"><thead><tr><th>标题</th><th>类型</th><th>优先级</th><th>提交时间</th><th>状态</th><th>处理说明</th></tr></thead><tbody>
        {currentData.tickets.map((item) => <tr key={item.id}><td><strong>{item.title || '未命名工单'}</strong><br /><span className="table-subtext">{item.content}</span></td><td>{item.ticket_type}</td><td><Badge tone={toneFor(item.priority)}>{item.priority}</Badge></td><td>{formatDate(item.create_time, true)}</td><td><Badge tone={toneFor(item.status)}>{labelFor(item.status)}</Badge></td><td>{item.solution || '—'}</td></tr>)}
      </tbody></table></div> : <Empty title="暂无反馈工单" desc="遇到问题或有建议时，可以直接新建工单。" action={<Button size="sm" variant="primary" onClick={() => openModal('ticket')}>新建工单</Button>} />}
    </Panel>
  }

  function renderAcademic() {
    return <div className="student-tab-grid student-tab-grid--wide">
      <Panel flush title="学业节点" desc="通用与学生专属的截止时间" icon={<CalendarClock size={16} />}>
        {currentData.deadlines.length ? <div className="table-wrap"><table className="table"><thead><tr><th>节点</th><th>类型</th><th>截止时间</th><th>状态</th></tr></thead><tbody>{currentData.deadlines.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><br /><span className="table-subtext">{item.description || '—'}</span></td><td>{item.deadline_type}</td><td>{formatDate(item.deadline, true)}</td><td><Badge tone={toneFor(item.status)}>{labelFor(item.status)}</Badge></td></tr>)}</tbody></table></div> : <Empty title="暂无学业节点" />}
      </Panel>
      <Panel flush title="成绩记录" desc="按学期展示当前学生成绩" icon={<GraduationCap size={16} />}>
        {currentData.scores.length ? <>
          <div className="student-score-toolbar">
            <p>{displayedScores[0]?.semester || '暂无学期信息'} · 共 {currentData.scores.length} 条成绩</p>
            <Select aria-label="按科目筛选成绩" value={scoreCourse} onChange={(event) => setScoreCourse(event.target.value)}>
              <option value="all">全部科目</option>
              {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
            </Select>
          </div>
          <div className="student-score-summary">
            <div><span>平均成绩</span><strong>{scoreAverage.toFixed(1)}</strong></div>
            <div><span>已获学分</span><strong>{totalCredits.toFixed(1)}</strong></div>
            <div><span>展示科目</span><strong>{displayedScores.length}</strong></div>
          </div>
          <div className="student-score-bars">
            {displayedScores.map((item) => <div key={item.id} className="student-score-row">
              <div className="student-score-course"><strong>{item.course_name}</strong><span>{item.semester || '—'} · {scoreLevel(item.score)}</span></div>
              <div className="student-score-track"><i style={{ width: scoreBarWidth(item.score) }} /></div>
              <b>{Number(item.score).toFixed(1)}</b>
            </div>)}
          </div>
          <div className="table-wrap"><table className="table"><thead><tr><th>课程</th><th>学期</th><th>成绩</th><th>学分</th></tr></thead><tbody>{displayedScores.map((item) => <tr key={item.id}><td>{item.course_name}</td><td>{item.semester || '—'}</td><td><strong>{item.score}</strong></td><td>{item.credit ?? '—'}</td></tr>)}</tbody></table></div>
        </> : <Empty title="暂无成绩记录" />}
      </Panel>
    </div>
  }

  function renderProgress() {
    return <Panel flush title="申请进度" desc="学生和顾问共同维护申请阶段" icon={<GraduationCap size={16} />} actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openModal('progress')}>新增进度</Button>}>
      {currentData.progress.length ? <div className="table-wrap"><table className="table"><thead><tr><th>目标院校</th><th>专业</th><th>阶段</th><th>截止日期</th><th>下一步</th></tr></thead><tbody>{currentData.progress.map((item) => <tr key={item.id}><td><strong>{item.target_school}</strong><br /><span className="table-subtext">{item.progress_detail || '—'}</span></td><td>{item.target_major || '—'}</td><td><Badge tone={item.stage === 'offer_received' ? 'success' : 'info'}>{labelFor(item.stage)}</Badge></td><td>{formatDate(item.deadline)}</td><td>{item.next_action || '—'}</td></tr>)}</tbody></table></div> : <Empty title="暂无申请进度" desc="新增目标院校后，可以持续追踪材料、审核和签证阶段。" action={<Button size="sm" variant="primary" onClick={() => openModal('progress')}>新增进度</Button>} />}
    </Panel>
  }

  function renderLife() {
    return <Panel flush title="海外生活知识" desc={displayStudent?.abroad_country ? `当前国家：${displayStudent.abroad_country}` : '学生所在国家尚未填写'} icon={<LifeBuoy size={16} />} actions={<Button size="sm" variant="primary" icon={<Send size={14} />} onClick={() => openChat('life')}>咨询助手</Button>}>
      <div className="student-care-grid">
        <article className="student-care-card">
          <span className="svc-icon"><HeartPulse size={16} /></span>
          <h3>心理关怀</h3>
          <p>情绪倾诉会被谨慎记录；出现高风险信号时，仅向负责老师发出人工跟进提醒。</p>
          <Button size="sm" variant="secondary" onClick={() => openChat('psych')}>开始倾诉</Button>
        </article>
        <article className="student-care-card">
          <span className="svc-icon"><LifeBuoy size={16} /></span>
          <h3>海外生活支持</h3>
          <p>可查询当地医疗、交通、紧急求助和日常生活信息，按留学国家检索知识库。</p>
          <Button size="sm" variant="secondary" onClick={() => openChat('life')}>查询生活支持</Button>
        </article>
        <article className="student-care-card">
          <span className="svc-icon"><GraduationCap size={16} /></span>
          <h3>升学项目咨询</h3>
          <p>根据申请阶段和明确意向，匹配语言、背景提升或学历提升项目。</p>
          <Button size="sm" variant="secondary" onClick={() => openChat('program')}>咨询项目</Button>
        </article>
      </div>
      {currentData.knowledge.length ? <div className="knowledge-grid">{currentData.knowledge.map((item) => <article className="knowledge-item" key={item.id}><div className="knowledge-meta"><Badge tone="info">{item.category}</Badge><span>{item.country}</span></div><h3>{item.title}</h3><p>{item.content}</p></article>)}</div> : <Empty title="暂无海外生活知识" desc="请检查学生的留学国家信息，或直接咨询生活助手。" action={<Button size="sm" variant="primary" onClick={() => openChat('life')}>咨询助手</Button>} />}
    </Panel>
  }

  function renderTab() {
    if (tab === 'overview') return renderOverview()
    if (tab === 'leaves') return renderLeaves()
    if (tab === 'tickets') return renderTickets()
    if (tab === 'academic') return renderAcademic()
    if (tab === 'progress') return renderProgress()
    return renderLife()
  }

  return <section className="student-service-page">
    <PageHeader
      eyebrow={<><UserRound size={13} />Student Service</>}
      title="学生助手"
      desc={isStudent ? '查看个人服务、学业进度和智能助手对话。' : '选择负责学生，集中处理行政服务、学业节点与智能助手会话。'}
      actions={<div className="page-action-row">
        <Badge tone={usingRemoteData ? 'success' : 'warning'} dot>{usingRemoteData ? '已连接业务服务' : '演示数据模式'}</Badge>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={loadingStudents || loadingData} onClick={() => void refresh()}>刷新</Button>
        <Button variant="primary" size="sm" icon={<MessageCircle size={14} />} disabled={!selectedId} onClick={() => openChat('program')}>咨询助手</Button>
      </div>}
    />

    {studentError && <div className="alert"><span>{studentError}</span><Button size="sm" variant="ghost" onClick={() => void reloadStudents()}>重试</Button></div>}
    {!isStudent && !loadingStudents && students.length > 0 && <Panel className="student-selector-panel" tight>
      <div className="student-selector"><Field label="当前服务对象" hint="普通员工仅能看到负责学生；经理和管理员可查看全部学生。"><Select value={selectedId ?? ''} onChange={(event) => setSelectedId(Number(event.target.value) || null)}><option value="">请选择学生</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.student_no || '未填写学号'}</option>)}</Select></Field><div className="student-selector-meta">{selectedStudent ? <><strong>{selectedStudent.school || '学校未填写'}</strong><span>{[selectedStudent.major, selectedStudent.grade, selectedStudent.abroad_country].filter(Boolean).join(' · ') || '档案信息待补充'}</span></> : <span>选择后加载学生服务数据</span>}</div></div>
    </Panel>}
    {!loadingStudents && !studentError && students.length === 0 && <Empty title={isStudent ? '学生档案不可用' : '暂无可服务学生'} desc={isStudent ? '当前账号尚未建立学生档案。' : '当前账号没有可访问的学生档案。'} />}

    {selectedId && displayStudent && <>
      <div className="student-identity-strip"><div className="student-identity-avatar"><UserRound size={18} /></div><div><strong>{displayStudent.name}</strong><span>{[displayStudent.student_no, displayStudent.school, displayStudent.major].filter(Boolean).join(' · ') || '学生档案信息待补充'}</span></div><div className="student-identity-actions"><Button size="sm" variant="ghost" onClick={() => openChat('psych')} icon={<HeartPulse size={14} />}>心理关怀</Button><Button size="sm" variant="ghost" onClick={() => openChat('life')} icon={<LifeBuoy size={14} />}>生活支持</Button></div></div>
      {dataError && <div className="alert"><span>{dataError}</span><Button size="sm" variant="ghost" onClick={() => void loadData()}>重试</Button></div>}
      {loadingData && !data && <Panel><div className="loading-pill"><RefreshCw size={15} className="spinner" />正在加载学生服务数据</div></Panel>}
      {data && <>
        <div className="student-metrics">
          <button type="button" className="stat-btn" onClick={() => setTab('leaves')}>
            <StatCard label="待审批请假" value={data.overview.pending_leaves} hint="查看申请状态" />
          </button>
          <button type="button" className="stat-btn" onClick={() => setTab('tickets')}>
            <StatCard label="处理中工单" value={data.overview.open_tickets} hint="跟进服务反馈" />
          </button>
          <button type="button" className="stat-btn" onClick={() => setTab('academic')}>
            <StatCard label="临近关键节点" value={data.overview.upcoming_deadlines} hint="论文、申请与签证" />
          </button>
          <button type="button" className="stat-btn" onClick={() => setTab('life')}>
            <StatCard label="心理关怀状态" value={data.overview.open_psych_alerts ? '需跟进' : '正常'} textValue hint="需要时可随时倾诉" />
          </button>
        </div>
        <Panel title="我能帮你处理什么？" desc="直接告诉我你的问题或要办理的事项" icon={<MessageCircle size={16} />}>
          <div className="student-assistant-reply">{assistantReply}</div>
          <div className="student-assistant-quick">
            <button type="button" onClick={() => handleAssistantRequest('我想请假')}>我想请假</button>
            <button type="button" onClick={() => handleAssistantRequest('查看申请进度')}>查看申请进度</button>
            <button type="button" onClick={() => handleAssistantRequest('查询论文 DDL')}>查询论文 DDL</button>
            <button type="button" onClick={() => handleAssistantRequest('最近压力很大')}>最近压力很大</button>
          </div>
          <div className="student-assistant-input">
            <Input
              value={assistantInput}
              placeholder="例如：帮我查一下签证材料进度"
              onChange={(event) => setAssistantInput(event.target.value)}
              onKeyDown={(event) => {
                // IME 组合期不触发发送(照搬旧版守卫)
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  handleAssistantRequest(assistantInput)
                }
              }}
            />
            <Button variant="primary" icon={<Send size={15} />} aria-label="发送" onClick={() => handleAssistantRequest(assistantInput)}>发送</Button>
          </div>
        </Panel>
        <Panel className="student-tabs-panel" flush><Tabs items={tabs} value={tab} onChange={setTab} /></Panel>
        {renderTab()}
      </>}
    </>}

    <Modal open={modal === 'leave'} onClose={closeModal} title="提交请假申请" desc="提交后会进入对应班主任或服务人员的审批队列。" footer={<><Button variant="secondary" onClick={closeModal}>取消</Button><Button variant="primary" loading={submitting} onClick={() => (document.getElementById('leave-form') as HTMLFormElement | null)?.requestSubmit()}>提交申请</Button></>}>
      <form id="leave-form" className="form-grid" onSubmit={submitLeave}><Field label="请假类型"><Select value={leaveForm.leave_type} onChange={(event) => setLeaveForm({ ...leaveForm, leave_type: event.target.value })}><option value="sick">病假</option><option value="personal">事假</option><option value="emergency">紧急假</option></Select></Field><Field label="开始时间"><Input type="datetime-local" required value={leaveForm.start_time} onChange={(event) => setLeaveForm({ ...leaveForm, start_time: event.target.value })} /></Field><Field label="结束时间"><Input type="datetime-local" required value={leaveForm.end_time} onChange={(event) => setLeaveForm({ ...leaveForm, end_time: event.target.value })} /></Field><Field label="附件地址" hint="可选"><Input value={leaveForm.attachment_url} onChange={(event) => setLeaveForm({ ...leaveForm, attachment_url: event.target.value })} placeholder="https://..." /></Field><Field label="请假事由"><Textarea required rows={4} value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} placeholder="请填写具体事由" /></Field></form>
    </Modal>

    <Modal open={modal === 'ticket'} onClose={closeModal} title="新建反馈工单" desc="描述越完整，服务人员越容易快速定位问题。" footer={<><Button variant="secondary" onClick={closeModal}>取消</Button><Button variant="primary" loading={submitting} onClick={() => (document.getElementById('ticket-form') as HTMLFormElement | null)?.requestSubmit()}>提交工单</Button></>}>
      <form id="ticket-form" className="form-grid" onSubmit={submitTicket}><Field label="工单类型"><Select value={ticketForm.ticket_type} onChange={(event) => setTicketForm({ ...ticketForm, ticket_type: event.target.value })}><option value="complaint">投诉</option><option value="suggestion">建议</option><option value="consult">咨询</option></Select></Field><Field label="问题分类"><Select value={ticketForm.category} onChange={(event) => setTicketForm({ ...ticketForm, category: event.target.value })}><option value="签证办理">签证办理</option><option value="院校申请">院校申请</option><option value="生活服务">生活服务</option><option value="其他">其他</option></Select></Field><Field label="优先级"><Select value={ticketForm.priority} onChange={(event) => setTicketForm({ ...ticketForm, priority: event.target.value })}><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="urgent">紧急</option></Select></Field><Field label="标题"><Input required value={ticketForm.title} onChange={(event) => setTicketForm({ ...ticketForm, title: event.target.value })} /></Field><Field label="问题描述"><Textarea required rows={4} value={ticketForm.content} onChange={(event) => setTicketForm({ ...ticketForm, content: event.target.value })} /></Field><Field label="补充详情" hint="可选"><Textarea rows={3} value={ticketForm.detail} onChange={(event) => setTicketForm({ ...ticketForm, detail: event.target.value })} /></Field></form>
    </Modal>

    <Modal open={modal === 'progress'} onClose={closeModal} title="新增申请进度" desc="记录目标院校与当前处理阶段，便于后续持续跟进。" footer={<><Button variant="secondary" onClick={closeModal}>取消</Button><Button variant="primary" loading={submitting} onClick={() => (document.getElementById('progress-form') as HTMLFormElement | null)?.requestSubmit()}>保存进度</Button></>}>
      <form id="progress-form" className="form-grid" onSubmit={submitProgress}><Field label="目标院校"><Input required value={progressForm.target_school} onChange={(event) => setProgressForm({ ...progressForm, target_school: event.target.value })} /></Field><Field label="目标专业"><Input value={progressForm.target_major} onChange={(event) => setProgressForm({ ...progressForm, target_major: event.target.value })} /></Field><Field label="截止日期"><Input type="date" value={progressForm.deadline} onChange={(event) => setProgressForm({ ...progressForm, deadline: event.target.value })} /></Field><Field label="下一步"><Input value={progressForm.next_action} onChange={(event) => setProgressForm({ ...progressForm, next_action: event.target.value })} /></Field><Field label="进度说明"><Textarea rows={4} value={progressForm.progress_detail} onChange={(event) => setProgressForm({ ...progressForm, progress_detail: event.target.value })} /></Field></form>
    </Modal>
  </section>
}
