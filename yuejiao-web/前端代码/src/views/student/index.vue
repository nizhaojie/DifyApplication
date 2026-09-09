<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
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
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type TicketStatus = 'pending' | 'processing' | 'resolved' | 'closed'
type SupportMode = 'psych' | 'life' | 'program'

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

const apiBase = 'http://127.0.0.1:8002/api/v1/student'
const router = useRouter()
const usingRemoteData = ref(false)
const loading = ref(false)
const activePanel = ref('overview')
const focusedDeadlineId = ref<number | null>(null)
const focusedTicketId = ref<number | null>(null)
const leaveDialogVisible = ref(false)
const ticketDialogVisible = ref(false)
const progressDialogVisible = ref(false)
const supportDialogVisible = ref(false)
const supportMode = ref<SupportMode>('psych')
const supportInput = ref('')
const assistantInput = ref('')
const assistantReply = ref('你好，我可以直接为你打开请假、反馈、学业和申请进度服务；心理、海外生活和升学咨询会进入对应的智能对话。')
const currentStudent = {
  name: '张明',
  studentNo: 'YJ2026001',
  school: '曼彻斯特大学',
}

const overview = ref({ pending_leaves: 1, open_tickets: 1, upcoming_deadlines: 3, open_psych_alerts: 0 })
const leaves = ref<LeaveItem[]>([
  {
    id: 1001,
    leave_type: '病假',
    start_time: '2026-09-10 08:00',
    end_time: '2026-09-10 18:00',
    reason: '身体不适，申请请假一天。',
    status: 'pending',
  },
])
const tickets = ref<TicketItem[]>([
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
const deadlines = ref<DeadlineItem[]>([
  { id: 3001, deadline_type: 'paper', title: '论文选题提交', description: '提交选题确认表至教学平台主管。', deadline: '2026-09-12 17:00', status: 'pending' },
  { id: 3002, deadline_type: 'application', title: '硕士申请材料补充', description: '补充成绩单和推荐信扫描件。', deadline: '2026-09-16 18:00', status: 'pending' },
  { id: 3003, deadline_type: 'visa', title: '签证体检预约', description: '完成指定医院体检预约。', deadline: '2026-09-25 12:00', status: 'pending' },
])
const scores = ref<ScoreItem[]>([])
const selectedCourse = ref('all')
const progressList = ref<ProgressItem[]>([
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

const leaveForm = ref({ leave_type: 'sick', range: [] as string[], reason: '', attachment_url: '' })
const ticketForm = ref({ ticket_type: 'complaint', category: '签证办理', title: '', detail: '', priority: 'medium' })
const progressForm = ref({ target_school: '', target_major: '', progress_detail: '', deadline: '', next_action: '' })
const psychMessages = ref([
  { role: 'assistant', content: '你好，我会认真倾听你的感受。你可以说说最近让你困扰的事情。' },
])
const lifeCategory = ref('medical')
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

function getLeaveStatus(status: string) {
  return leaveStatusMap[status as LeaveStatus] ?? leaveStatusMap.pending
}

function getTicketStatus(status: string) {
  return ticketStatusMap[status as TicketStatus] ?? ticketStatusMap.pending
}

const nearestDeadline = computed(() => deadlines.value[0])
const openTicket = computed(() => tickets.value.find((item) => item.status === 'processing' || item.status === 'pending'))
const courseOptions = computed(() => [...new Set(scores.value.map((item) => item.course_name))])
const displayedScores = computed(() => selectedCourse.value === 'all'
  ? scores.value
  : scores.value.filter((item) => item.course_name === selectedCourse.value))
const scoreAverage = computed(() => {
  if (!displayedScores.value.length) return 0
  return displayedScores.value.reduce((total, item) => total + Number(item.score), 0) / displayedScores.value.length
})
const totalCredits = computed(() => displayedScores.value.reduce((total, item) => total + Number(item.credit ?? 0), 0))
const supportTitle = computed(() => ({ psych: '心理关怀', life: '海外生活支持', program: '升学项目咨询' })[supportMode.value])
const visibleLifeArticles = computed(() => lifeArticles.filter((item) => item.category === lifeCategory.value))

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

async function loadRemoteData() {
  loading.value = true
  try {
    const [remoteOverview, remoteLeaves, remoteTickets, remoteDeadlines, remoteScores, remoteProgress] = await Promise.all([
      request<typeof overview.value>('/overview'),
      request<LeaveItem[]>('/leaves'),
      request<TicketItem[]>('/tickets'),
      request<DeadlineItem[]>('/academic/deadlines'),
      request<ScoreItem[]>('/academic/scores?all_students=true'),
      request<ProgressItem[]>('/application-progress'),
    ])
    overview.value = remoteOverview
    leaves.value = remoteLeaves
    tickets.value = remoteTickets
    deadlines.value = remoteDeadlines
    scores.value = remoteScores
    progressList.value = remoteProgress
    usingRemoteData.value = true
  } catch {
    usingRemoteData.value = false
  } finally {
    loading.value = false
  }
}

function openLeaveDialog() {
  leaveDialogVisible.value = true
}

function openTicketDialog() {
  ticketDialogVisible.value = true
}

function focusDeadline(item: DeadlineItem) {
  activePanel.value = 'academic'
  focusedDeadlineId.value = item.id
}

function focusTicket(item: TicketItem) {
  activePanel.value = 'ticket'
  focusedTicketId.value = item.id
}

function openSupport(mode: SupportMode) {
  const routeByMode: Record<SupportMode, string> = {
    psych: '/student/psych',
    life: '/student/life',
    program: '/student/program',
  }
  void router.push(routeByMode[mode])
}

function submitPsychMessage() {
  const content = supportInput.value.trim()
  if (!content) return
  psychMessages.value.push({ role: 'user', content })
  const highRisk = /不想活|自杀|伤害自己|撑不住|结束生命/.test(content)
  if (highRisk) {
    overview.value.open_psych_alerts = Math.max(1, overview.value.open_psych_alerts)
    psychMessages.value.push({ role: 'assistant', content: '谢谢你愿意告诉我。你现在的安全最重要，请立刻联系身边可信任的人、学校老师或当地紧急支持服务。我已为你标记人工关怀跟进。' })
    ElMessage.warning('已标记为需要人工关怀跟进')
  } else {
    psychMessages.value.push({ role: 'assistant', content: '我听到了你的感受。你不需要一个人承担这些压力，我们可以一起把当前最困扰你的事情拆成更小的一步。' })
  }
  supportInput.value = ''
}

async function submitLeave() {
  if (leaveForm.value.range.length !== 2 || !leaveForm.value.reason.trim()) {
    ElMessage.warning('请补充请假时间和事由')
    return
  }
  const payload = {
    leave_type: leaveForm.value.leave_type,
    start_time: leaveForm.value.range[0],
    end_time: leaveForm.value.range[1],
    reason: leaveForm.value.reason.trim(),
    attachment_url: leaveForm.value.attachment_url || undefined,
  }
  try {
    const result = await request<LeaveItem>('/leaves', { method: 'POST', body: JSON.stringify(payload) })
    leaves.value.unshift(result)
    usingRemoteData.value = true
  } catch {
    ElMessage.error('请假申请提交失败，请检查后端连接后重试')
    return
  }
  overview.value.pending_leaves += 1
  leaveDialogVisible.value = false
  leaveForm.value = { leave_type: 'sick', range: [], reason: '', attachment_url: '' }
  ElMessage.success('请假申请已提交，等待班主任审批')
}

async function submitTicket() {
  if (!ticketForm.value.title.trim() || !ticketForm.value.detail.trim()) {
    ElMessage.warning('请填写反馈标题和详细说明')
    return
  }
  const payload = {
    ...ticketForm.value,
    content: ticketForm.value.detail.trim().slice(0, 120),
    detail: ticketForm.value.detail.trim(),
  }
  try {
    const result = await request<TicketItem>('/tickets', { method: 'POST', body: JSON.stringify(payload) })
    tickets.value.unshift(result)
    usingRemoteData.value = true
  } catch {
    ElMessage.error('反馈工单提交失败，请检查后端连接后重试')
    return
  }
  overview.value.open_tickets += 1
  ticketDialogVisible.value = false
  ticketForm.value = { ticket_type: 'complaint', category: '签证办理', title: '', detail: '', priority: 'medium' }
  ElMessage.success('反馈工单已提交，工作人员会尽快处理')
}
async function submitProgress() {
  if (!progressForm.value.target_school.trim()) { ElMessage.warning('请填写目标院校'); return }
  try { const result = await request<ProgressItem>('/application-progress', { method: 'POST', body: JSON.stringify({ ...progressForm.value, deadline: progressForm.value.deadline || undefined }) }); progressList.value.unshift(result); progressDialogVisible.value = false; progressForm.value = { target_school: '', target_major: '', progress_detail: '', deadline: '', next_action: '' }; ElMessage.success('申请进度已提交，等待顾问处理') } catch { ElMessage.error('申请提交失败，请检查后端连接后重试') }
}

async function handleAssistantRequest(rawInput: string) {
  const content = rawInput.trim()
  if (!content) return
  const normalized = content.toLowerCase()
  assistantInput.value = ''

  if (/请假|病假|事假|紧急假/.test(normalized)) {
    assistantReply.value = '已为你打开请假申请。请补充请假类型、时间和事由后提交。'
    openLeaveDialog()
    return
  }
  if (/投诉|反馈|建议|工单/.test(normalized)) {
    assistantReply.value = '已为你打开投诉反馈表单。填写问题标题和详细说明后即可提交工单。'
    openTicketDialog()
    return
  }
  if (/申请进度|院校审核|签证进度|材料进度/.test(normalized)) {
    activePanel.value = 'progress'
    assistantReply.value = '已切换到申请进度，可查看院校、材料、签证等当前办理阶段。'
    return
  }
  if (/论文|ddl|成绩|考试|学业/.test(normalized)) {
    activePanel.value = 'academic'
    assistantReply.value = `已切换到学业考务。最近节点是“${nearestDeadline.value?.title ?? '暂无待办'}”，截止时间为 ${nearestDeadline.value?.deadline ?? '暂无'}。`
    return
  }
  if (/压力|焦虑|难过|失眠|心理|倾诉/.test(normalized)) {
    assistantReply.value = '正在进入心理关怀智能对话。'
    await router.push('/student/psych')
    return
  }
  if (/海外|英国|医疗|交通|住宿|生活/.test(normalized)) {
    assistantReply.value = '正在进入海外生活支持智能对话。'
    await router.push('/student/life')
    return
  }
  if (/升学|硕博|科研|语言|项目咨询/.test(normalized)) {
    assistantReply.value = '正在进入学业提升咨询智能对话。'
    await router.push('/student/program')
    return
  }

  assistantReply.value = '我暂时未识别到具体办理事项。你可以直接说“我想请假”“查看申请进度”“查询论文 DDL”，或进入心理、生活、升学智能对话。'
}

function askAssistant(prompt: string) {
  void handleAssistantRequest(prompt)
}

function sendAssistantMessage() {
  void handleAssistantRequest(assistantInput.value)
}

onMounted(() => {
  void loadRemoteData()
})
</script>

<template>
  <section class="student-page" v-loading="loading">
    <header class="page-heading">
      <div>
        <p class="eyebrow">STUDENT SERVICE CENTER</p>
        <h1>学生智能助手</h1>
        <p>学习、申请与生活服务统一入口</p>
      </div>
      <div class="data-state" :class="{ remote: usingRemoteData }">
        <span class="state-dot"></span>
        {{ usingRemoteData ? '已连接业务服务' : '演示数据模式' }}
      </div>
    </header>

    <div class="metrics-grid">
      <button class="metric-card" type="button" @click="activePanel = 'leave'">
        <el-icon class="metric-icon leave"><Calendar /></el-icon>
        <span>待审批请假</span>
        <strong>{{ overview.pending_leaves }}</strong>
        <small>查看申请状态</small>
      </button>
      <button class="metric-card" type="button" @click="activePanel = 'ticket'">
        <el-icon class="metric-icon ticket"><Service /></el-icon>
        <span>处理中工单</span>
        <strong>{{ overview.open_tickets }}</strong>
        <small>跟进服务反馈</small>
      </button>
      <button class="metric-card" type="button" @click="activePanel = 'academic'">
        <el-icon class="metric-icon deadline"><Timer /></el-icon>
        <span>临近关键节点</span>
        <strong>{{ overview.upcoming_deadlines }}</strong>
        <small>论文、申请与签证</small>
      </button>
      <button class="metric-card" type="button" @click="activePanel = 'care'">
        <el-icon class="metric-icon care"><ChatDotRound /></el-icon>
        <span>心理关怀状态</span>
        <strong>{{ overview.open_psych_alerts ? '需跟进' : '正常' }}</strong>
        <small>需要时可随时倾诉</small>
      </button>
    </div>

    <div class="workbench-grid">
      <section class="assistant-panel" aria-label="学生助手对话">
        <div class="assistant-title">
          <div class="assistant-mark"><el-icon><ChatDotRound /></el-icon></div>
          <div>
            <h2>我能帮你处理什么？</h2>
            <p>直接告诉我你的问题或要办理的事项</p>
          </div>
        </div>
        <div class="assistant-reply">{{ assistantReply }}</div>
        <div class="quick-prompts">
          <button type="button" @click="askAssistant('我想请假')">我想请假</button>
          <button type="button" @click="askAssistant('查看申请进度')">查看申请进度</button>
          <button type="button" @click="askAssistant('查询论文 DDL')">查询论文 DDL</button>
          <button type="button" @click="askAssistant('最近压力很大')">最近压力很大</button>
        </div>
        <div class="assistant-input">
          <el-input v-model="assistantInput" placeholder="例如：帮我查一下签证材料进度" @keyup.enter="sendAssistantMessage" />
          <el-button type="primary" :icon="Promotion" circle aria-label="发送" @click="sendAssistantMessage" />
        </div>
      </section>

      <section class="attention-panel" aria-label="近期提醒">
        <div class="section-title">
          <div>
            <p>近期提醒</p>
            <h2>优先处理</h2>
          </div>
          <el-icon><Warning /></el-icon>
        </div>
        <button v-if="nearestDeadline" type="button" class="attention-item deadline-item" @click="focusDeadline(nearestDeadline)">
          <span class="attention-time">{{ nearestDeadline.deadline.slice(5, 10) }}</span>
          <div>
            <strong>{{ nearestDeadline.title }}</strong>
            <p>{{ nearestDeadline.description }}</p>
          </div>
          <span class="attention-action">查看详情</span>
        </button>
        <button v-if="openTicket" type="button" class="attention-item" @click="focusTicket(openTicket)">
          <span class="attention-time neutral">工单</span>
          <div>
            <strong>{{ openTicket.title }}</strong>
            <p>当前状态：{{ ticketStatusMap[openTicket.status].label }}</p>
          </div>
          <span class="attention-action">跟进工单</span>
        </button>
      </section>
    </div>

    <section class="service-section">
      <el-tabs v-model="activePanel" class="student-tabs">
        <el-tab-pane name="overview" label="我的服务">
          <div class="service-grid">
            <button type="button" class="service-card" @click="openLeaveDialog">
              <el-icon><Calendar /></el-icon>
              <div><strong>请假申请</strong><span>提交、撤销与查看审批结果</span></div>
            </button>
            <button type="button" class="service-card" @click="openTicketDialog">
              <el-icon><DocumentChecked /></el-icon>
              <div><strong>投诉反馈</strong><span>提交服务意见并追踪处理</span></div>
            </button>
            <button type="button" class="service-card" @click="activePanel = 'academic'">
              <el-icon><Reading /></el-icon>
              <div><strong>学业考务</strong><span>查询成绩、考试与关键 DDL</span></div>
            </button>
            <button type="button" class="service-card" @click="activePanel = 'progress'">
              <el-icon><School /></el-icon>
              <div><strong>申请进度</strong><span>掌握院校申请与签证节点</span></div>
            </button>
          </div>
        </el-tab-pane>

        <el-tab-pane name="leave" label="请假记录">
          <div class="panel-toolbar"><p>提交后将自动通知班主任审批。</p><el-button type="primary" :icon="Calendar" @click="openLeaveDialog">发起请假</el-button></div>
          <el-table :data="leaves" stripe>
            <el-table-column label="申请人" width="150"><template #default>{{ currentStudent.name }}（{{ currentStudent.studentNo }}）</template></el-table-column>
            <el-table-column prop="leave_type" label="类型" width="110" />
            <el-table-column prop="start_time" label="开始时间" min-width="160" />
            <el-table-column prop="end_time" label="结束时间" min-width="160" />
            <el-table-column prop="reason" label="事由" min-width="220" show-overflow-tooltip />
            <el-table-column label="状态" width="110"><template #default="scope"><el-tag :type="getLeaveStatus(scope.row.status).type">{{ getLeaveStatus(scope.row.status).label }}</el-tag></template></el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="ticket" label="投诉反馈">
          <div class="panel-toolbar"><p>工作人员处理后会在这里同步解决方案。</p><el-button type="primary" :icon="DocumentChecked" @click="openTicketDialog">提交反馈</el-button></div>
          <el-table :data="tickets" stripe :row-class-name="({ row }: { row: TicketItem }) => row.id === focusedTicketId ? 'focused-row' : ''">
            <el-table-column prop="title" label="工单标题" min-width="180" />
            <el-table-column prop="category" label="分类" width="120" />
            <el-table-column prop="priority" label="优先级" width="100" />
            <el-table-column label="状态" width="110"><template #default="scope"><el-tag :type="getTicketStatus(scope.row.status).type">{{ getTicketStatus(scope.row.status).label }}</el-tag></template></el-table-column>
            <el-table-column prop="solution" label="处理方案" min-width="180"><template #default="scope">{{ scope.row.solution || '处理中，暂未结案' }}</template></el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="academic" label="学业考务">
          <div class="academic-layout">
            <div><h3>关键节点</h3><el-table :data="deadlines" size="small" :row-class-name="({ row }: { row: DeadlineItem }) => row.id === focusedDeadlineId ? 'focused-row' : ''"><el-table-column prop="title" label="事项" min-width="160" /><el-table-column prop="deadline" label="截止时间" width="160" /><el-table-column prop="deadline_type" label="类型" width="110" /></el-table></div>
            <div class="score-panel">
              <div class="score-panel-header"><div><h3>课程成绩</h3><span>{{ displayedScores[0]?.semester || scores[0]?.semester || '暂无学期信息' }} · 数据库共 {{ scores.length }} 条</span></div><el-icon><CircleCheck /></el-icon></div>
              <el-select v-model="selectedCourse" class="course-filter" aria-label="按科目筛选成绩">
                <el-option label="全部科目" value="all" />
                <el-option v-for="course in courseOptions" :key="course" :label="course" :value="course" />
              </el-select>
              <div v-if="displayedScores.length" class="score-summary"><div><span>平均成绩</span><strong>{{ scoreAverage.toFixed(1) }}</strong></div><div><span>已获学分</span><strong>{{ totalCredits.toFixed(1) }}</strong></div><div><span>展示科目</span><strong>{{ displayedScores.length }}</strong></div></div>
              <div v-if="displayedScores.length" class="score-bars"><div v-for="item in displayedScores" :key="item.id" class="score-row"><div class="score-course"><strong>{{ item.course_name }}</strong><span>学生 {{ item.student_id }} · {{ item.credit ?? 0 }} 学分 · {{ scoreLevel(item.score) }}</span></div><div class="score-track"><i :style="{ width: scoreBarWidth(item.score) }"></i></div><b>{{ Number(item.score).toFixed(1) }}</b></div></div>
              <el-empty v-else description="暂无成绩数据" :image-size="54" />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane name="progress" label="申请进度">
          <div class="panel-toolbar"><p>顾问处理后会同步更新申请阶段和下一步安排。</p><el-button type="primary" :icon="School" @click="progressDialogVisible = true">发起申请</el-button></div>
          <div class="progress-list">
            <article v-for="item in progressList" :key="item.id" class="progress-card">
              <div class="progress-stage">{{ stageLabel[item.stage] || item.stage }}</div>
              <div><h3>{{ item.target_school }}</h3><p>{{ item.target_major }}</p></div>
              <p class="progress-detail">{{ item.progress_detail }}</p>
              <div class="progress-next"><span>下一步</span><strong>{{ item.next_action }}</strong></div>
            </article>
          </div>
        </el-tab-pane>

        <el-tab-pane name="care" label="生活与关怀">
          <div class="care-grid">
            <article><el-icon><ChatDotRound /></el-icon><h3>心理关怀</h3><p>情绪倾诉会被谨慎记录；出现高风险信号时，仅向负责老师发出人工跟进提醒。</p><el-button text type="primary" @click="openSupport('psych')">开始倾诉</el-button></article>
            <article><el-icon><Service /></el-icon><h3>海外生活支持</h3><p>可查询当地医疗、交通、紧急求助和日常生活信息，正式版本将按留学国家检索知识库。</p><el-button text type="primary" @click="openSupport('life')">查询生活支持</el-button></article>
            <article><el-icon><School /></el-icon><h3>升学项目咨询</h3><p>根据申请阶段和明确意向，匹配语言、背景提升或学历提升项目。</p><el-button text type="primary" @click="openSupport('program')">咨询项目</el-button></article>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="supportDialogVisible" :title="supportTitle" width="600px">
      <template v-if="supportMode === 'psych'">
        <div class="psych-dialog">
          <div v-for="(message, index) in psychMessages" :key="index" class="psych-message" :class="message.role">
            {{ message.content }}
          </div>
        </div>
        <div class="psych-input"><el-input v-model="supportInput" type="textarea" :rows="3" placeholder="写下你现在的感受" @keyup.ctrl.enter="submitPsychMessage" /><el-button type="primary" @click="submitPsychMessage">发送</el-button></div>
      </template>
      <template v-else-if="supportMode === 'life'">
        <el-radio-group v-model="lifeCategory" class="life-category"><el-radio-button value="medical">医疗</el-radio-button><el-radio-button value="transport">交通</el-radio-button><el-radio-button value="emergency">紧急求助</el-radio-button><el-radio-button value="daily_life">日常生活</el-radio-button></el-radio-group>
        <div class="life-articles"><article v-for="item in visibleLifeArticles" :key="item.title"><h3>{{ item.title }}</h3><p>{{ item.content }}</p></article></div>
      </template>
      <template v-else>
        <div class="program-list"><article v-for="item in programOptions" :key="item.name"><div><el-tag size="small">{{ item.category }}</el-tag><h3>{{ item.name }}</h3></div><span>{{ item.duration }}</span><p>{{ item.description }}</p><el-button text type="primary" @click="ElMessage.success('咨询意向已记录，顾问将与你联系')">咨询此项目</el-button></article></div>
      </template>
    </el-dialog>

    <el-dialog v-model="leaveDialogVisible" title="发起请假申请" width="520px" destroy-on-close>
      <div class="applicant-note"><span>当前申请人</span><strong>{{ currentStudent.name }}（{{ currentStudent.studentNo }}）</strong><small>{{ currentStudent.school }}</small></div>
      <el-form label-position="top">
        <el-form-item label="请假类型"><el-radio-group v-model="leaveForm.leave_type"><el-radio-button value="sick">病假</el-radio-button><el-radio-button value="personal">事假</el-radio-button><el-radio-button value="emergency">紧急请假</el-radio-button></el-radio-group></el-form-item>
        <el-form-item label="请假时间"><el-date-picker v-model="leaveForm.range" type="datetimerange" value-format="YYYY-MM-DDTHH:mm:ss" start-placeholder="开始时间" end-placeholder="结束时间" style="width: 100%" /></el-form-item>
        <el-form-item label="请假事由"><el-input v-model="leaveForm.reason" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
        <el-form-item label="附件链接（可选）"><el-input v-model="leaveForm.attachment_url" placeholder="病假证明等附件地址" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="leaveDialogVisible = false">取消</el-button><el-button type="primary" @click="submitLeave">确认提交</el-button></template>
    </el-dialog>

    <el-dialog v-model="ticketDialogVisible" title="提交投诉反馈" width="560px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="反馈类型"><el-radio-group v-model="ticketForm.ticket_type"><el-radio-button value="complaint">投诉</el-radio-button><el-radio-button value="suggestion">建议</el-radio-button><el-radio-button value="consult">咨询</el-radio-button></el-radio-group></el-form-item>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="问题分类"><el-select v-model="ticketForm.category" style="width: 100%"><el-option label="签证办理" value="签证办理" /><el-option label="院校申请" value="院校申请" /><el-option label="生活服务" value="生活服务" /><el-option label="其他" value="其他" /></el-select></el-form-item></el-col><el-col :span="12"><el-form-item label="优先级"><el-select v-model="ticketForm.priority" style="width: 100%"><el-option label="低" value="low" /><el-option label="中" value="medium" /><el-option label="高" value="high" /><el-option label="紧急" value="urgent" /></el-select></el-form-item></el-col></el-row>
        <el-form-item label="标题"><el-input v-model="ticketForm.title" maxlength="80" show-word-limit /></el-form-item>
        <el-form-item label="详细说明"><el-input v-model="ticketForm.detail" type="textarea" :rows="5" maxlength="2000" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button @click="ticketDialogVisible = false">取消</el-button><el-button type="primary" @click="submitTicket">提交工单</el-button></template>
    </el-dialog>
    <el-dialog v-model="progressDialogVisible" title="发起申请进度" width="560px" destroy-on-close><el-form label-position="top"><el-form-item label="目标院校"><el-input v-model="progressForm.target_school" /></el-form-item><el-form-item label="目标专业"><el-input v-model="progressForm.target_major" /></el-form-item><el-form-item label="申请说明"><el-input v-model="progressForm.progress_detail" type="textarea" :rows="3" /></el-form-item><el-form-item label="期望截止日期"><el-date-picker v-model="progressForm.deadline" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item><el-form-item label="下一步安排"><el-input v-model="progressForm.next_action" /></el-form-item></el-form><template #footer><el-button @click="progressDialogVisible = false">取消</el-button><el-button type="primary" @click="submitProgress">提交申请</el-button></template></el-dialog>
  </section>
</template>

<style scoped>
.student-page { max-width: 1380px; margin: 0 auto; color: #303133; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; }
.page-heading h1 { margin: 2px 0 6px; font-size: 24px; line-height: 1.2; }
.page-heading p { margin: 0; color: #7a808a; font-size: 13px; }
.eyebrow { color: #c41e1e !important; font-size: 11px !important; font-weight: 700; letter-spacing: .08em; }
.data-state { display: flex; align-items: center; gap: 7px; padding: 7px 10px; border: 1px solid #e4e7ed; background: #fff; color: #909399; font-size: 12px; }
.data-state.remote { border-color: #b3e19d; color: #529b2e; }
.state-dot { width: 7px; height: 7px; border-radius: 50%; background: #a8abb2; }
.remote .state-dot { background: #67c23a; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
.metric-card { display: grid; grid-template-columns: 44px 1fr; grid-template-rows: 20px 30px 18px; column-gap: 10px; align-items: center; min-height: 112px; padding: 14px; text-align: left; border: 1px solid #e4e7ed; border-radius: 6px; background: #fff; cursor: pointer; transition: border-color .2s, box-shadow .2s; }
.metric-card:hover { border-color: #c41e1e; box-shadow: 0 4px 12px rgba(40, 40, 40, .08); }
.metric-icon { grid-row: 1 / 4; display: grid; width: 42px; height: 42px; place-items: center; border-radius: 5px; font-size: 20px; background: #fdf0f0; color: #c41e1e; }
.metric-icon.ticket { background: #ecf5ff; color: #409eff; }.metric-icon.deadline { background: #fdf6ec; color: #e6a23c; }.metric-icon.care { background: #f0f9eb; color: #67c23a; }
.metric-card span, .metric-card small { color: #7a808a; font-size: 12px; }.metric-card strong { font-size: 24px; line-height: 1; }
.workbench-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(320px, .9fr); gap: 16px; margin-bottom: 16px; }
.assistant-panel, .attention-panel, .service-section { border: 1px solid #e4e7ed; border-radius: 6px; background: #fff; }
.assistant-panel { padding: 20px; }.assistant-title { display: flex; align-items: center; gap: 11px; }.assistant-mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 5px; background: #c41e1e; color: #fff; font-size: 19px; }.assistant-title h2, .section-title h2 { margin: 0; font-size: 16px; }.assistant-title p, .section-title p { margin: 4px 0 0; color: #909399; font-size: 12px; }
.assistant-reply { margin: 17px 0 12px; padding: 12px 14px; border-left: 3px solid #c41e1e; background: #fff8f8; color: #4b4b4b; line-height: 1.65; font-size: 14px; }.quick-prompts { display: flex; flex-wrap: wrap; gap: 8px; }.quick-prompts button { padding: 6px 9px; border: 1px solid #dcdfe6; border-radius: 4px; background: #fff; color: #606266; font-size: 12px; cursor: pointer; }.quick-prompts button:hover { color: #c41e1e; border-color: #c41e1e; }.assistant-input { display: flex; gap: 8px; margin-top: 14px; }
.attention-panel { padding: 18px; }.section-title { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #ebeef5; }.section-title > .el-icon { color: #e6a23c; font-size: 21px; }.attention-item { display: flex; width: 100%; gap: 10px; padding: 13px 0; border: 0; border-bottom: 1px solid #f0f2f5; background: transparent; text-align: left; cursor: pointer; }.attention-item:hover strong, .attention-item:hover .attention-action { color: #c41e1e; }.attention-item:last-child { border-bottom: 0; }.attention-time { flex: 0 0 42px; height: 34px; display: grid; place-items: center; border-radius: 4px; background: #fdf6ec; color: #e6a23c; font-size: 11px; font-weight: 700; }.attention-time.neutral { background: #ecf5ff; color: #409eff; }.attention-item div { min-width: 0; flex: 1; }.attention-item strong { font-size: 13px; }.attention-item p { margin: 4px 0 0; color: #909399; font-size: 12px; line-height: 1.4; }.attention-action { align-self: center; color: #909399; font-size: 12px; white-space: nowrap; }.student-tabs :deep(.focused-row td.el-table__cell) { background: #fff7e8 !important; }
.service-section { padding: 0 18px 18px; }.student-tabs :deep(.el-tabs__header) { margin: 0 0 18px; }.student-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; }.student-tabs :deep(.el-tabs__item) { height: 52px; line-height: 52px; }.service-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }.service-card { display: flex; gap: 12px; min-height: 96px; padding: 15px; text-align: left; border: 1px solid #ebeef5; border-radius: 5px; background: #fff; cursor: pointer; }.service-card:hover { border-color: #c41e1e; background: #fffafa; }.service-card .el-icon { color: #c41e1e; font-size: 22px; }.service-card strong, .service-card span { display: block; }.service-card strong { margin-bottom: 6px; font-size: 14px; }.service-card span { color: #909399; font-size: 12px; line-height: 1.5; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }.panel-toolbar p { margin: 0; color: #909399; font-size: 13px; }.applicant-note { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 10px 12px; border-left: 3px solid #c41e1e; background: #fff8f8; }.applicant-note span, .applicant-note small { color: #909399; font-size: 12px; }.applicant-note strong { color: #303133; font-size: 13px; }.academic-layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: 18px; }.academic-layout h3 { margin: 0 0 12px; font-size: 15px; }.score-panel { min-height: 196px; padding: 16px; border: 1px solid #d9ecff; background: #f8fbff; }.score-panel-header { display: flex; align-items: flex-start; justify-content: space-between; }.score-panel-header h3 { margin-bottom: 3px; }.score-panel-header span { color: #909399; font-size: 12px; }.score-panel-header .el-icon { color: #409eff; font-size: 24px; }.course-filter { width: 100%; margin-top: 13px; }.score-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0; }.score-summary div { padding: 8px; border: 1px solid #e3eef9; background: #fff; }.score-summary span, .score-course span { display: block; color: #909399; font-size: 11px; }.score-summary strong { display: block; margin-top: 3px; color: #303133; font-size: 18px; }.score-bars { display: grid; gap: 11px; }.score-row { display: grid; grid-template-columns: minmax(85px, 1fr) minmax(72px, 1.25fr) 34px; align-items: center; gap: 8px; }.score-course { min-width: 0; }.score-course strong { display: block; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.score-course span { margin-top: 2px; }.score-track { height: 8px; overflow: hidden; border-radius: 4px; background: #e6eef7; }.score-track i { display: block; height: 100%; border-radius: inherit; background: #409eff; }.score-row b { color: #303133; font-size: 12px; text-align: right; }
.progress-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }.progress-card { display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; padding: 16px; border: 1px solid #ebeef5; border-top: 3px solid #c41e1e; }.progress-stage { padding: 4px 7px; align-self: start; border-radius: 3px; background: #fff2f2; color: #c41e1e; font-size: 11px; }.progress-card h3 { margin: 0; font-size: 15px; }.progress-card p { margin: 4px 0 0; color: #909399; font-size: 12px; }.progress-detail { grid-column: 1 / -1; min-height: 34px; line-height: 1.5; }.progress-next { grid-column: 1 / -1; padding-top: 10px; border-top: 1px solid #f0f2f5; }.progress-next span { margin-right: 8px; color: #909399; font-size: 12px; }.progress-next strong { font-size: 12px; font-weight: 500; }.care-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }.care-grid article { padding: 17px; border: 1px solid #ebeef5; }.care-grid .el-icon { color: #c41e1e; font-size: 23px; }.care-grid h3 { margin: 10px 0 6px; font-size: 15px; }.care-grid p { min-height: 56px; margin: 0; color: #7a808a; font-size: 12px; line-height: 1.6; }.psych-dialog { display: flex; max-height: 320px; flex-direction: column; gap: 10px; overflow-y: auto; padding: 4px; }.psych-message { max-width: 84%; padding: 10px 12px; border-radius: 5px; line-height: 1.6; font-size: 13px; }.psych-message.assistant { align-self: flex-start; background: #f4f4f5; color: #4b4b4b; }.psych-message.user { align-self: flex-end; background: #fdecec; color: #7c1a1a; }.psych-input { display: flex; align-items: flex-end; gap: 10px; margin-top: 14px; }.life-category { margin-bottom: 16px; }.life-articles article { padding: 16px; border: 1px solid #ebeef5; border-left: 3px solid #409eff; }.life-articles h3, .program-list h3 { margin: 0 0 8px; font-size: 15px; }.life-articles p, .program-list p { margin: 0; color: #606266; line-height: 1.65; font-size: 13px; }.program-list { display: grid; gap: 10px; }.program-list article { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; padding: 14px; border: 1px solid #ebeef5; }.program-list h3 { margin: 7px 0 0; }.program-list > article > span { color: #909399; font-size: 12px; }.program-list p, .program-list .el-button { grid-column: 1 / -1; }
@media (max-width: 980px) { .metrics-grid, .service-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.workbench-grid, .academic-layout { grid-template-columns: 1fr; }.care-grid { grid-template-columns: 1fr; }.care-grid p { min-height: auto; }.progress-list { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .page-heading { align-items: flex-start; gap: 10px; flex-direction: column; }.metrics-grid, .service-grid { grid-template-columns: 1fr; }.student-page { min-width: 0; }.service-section { padding: 0 12px 16px; }.panel-toolbar { align-items: flex-start; gap: 10px; flex-direction: column; } }
</style>
