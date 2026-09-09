<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import MarkdownText from '@/components/MarkdownText.vue'
import {
  addFollowUp,
  approveLeave,
  chat,
  clearMemory,
  fetchBrief,
  fetchChatStatus,
  fetchDailies,
  fetchLeadDetail,
  fetchLeads,
  fetchLeaves,
  fetchStudentProgress,
  updateStudentProgress,
  fetchStudentTickets,
  handleStudentTicket,
  fetchMemory,
  updateLeadStatus,
  type FollowUpItem,
  type LeadItem,
} from '@/api/enterprise'

type ChatMsg = {
  role: 'user' | 'assistant'
  text: string
  intent?: string
  citation?: string
  payload?: Record<string, unknown>
  pending?: boolean
}

const route = useRoute()
const loading = ref(false)
const sending = ref(false)
const online = ref(true)
const keyword = ref('')
const statusFilter = ref('')
const tab = ref('leads')
const draft = ref('')
const conversationId = ref<string | null>(null)
const brief = ref<Record<string, unknown>>({})
const leads = ref<LeadItem[]>([])
const dailies = ref<Record<string, unknown>[]>([])
const leaves = ref<Record<string, unknown>[]>([])
const studentProgress = ref<Record<string, unknown>[]>([])
const progressStage = ref('')
const studentTickets = ref<Record<string, unknown>[]>([])
const ticketStatus = ref('')
const logEl = ref<HTMLElement | null>(null)
const messages = reactive<ChatMsg[]>([])
const drawer = ref(false)
const currentLead = ref<LeadItem | null>(null)
const follows = ref<FollowUpItem[]>([])
const followDraft = ref('')
const followSaving = ref(false)

const capabilities = [
  { label: '录入客户', hint: '张三 13800138000 想咨询美国硕士' },
  { label: '今日待办', hint: '我今天有什么待办？' },
  { label: '入职指引', hint: '打印机在几楼？坏了找谁？' },
  { label: '批请假', hint: '同意张三的请假' },
]

function greetFrom(data: Record<string, unknown>) {
  const name = String(data.employee_name || '你好')
  return `${name}，待办 ${data.pending_todos ?? 0} 条，待审批请假 ${data.pending_leave_approvals ?? 0} 条，待处理投诉 ${data.pending_tickets ?? 0} 条。可以直接说客户，或点下面的能力。`
}

function joinField(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join('；') || '—'
  if (value) return String(value)
  return '—'
}

function fmtTime(value: unknown) {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 16)
}

function sqlOf(msg: ChatMsg) {
  const sql = msg.payload?.sql
  return typeof sql === 'string' ? sql : ''
}

function writeConfirm(text: string) {
  if (/(同意|批准|通过|拒绝|驳回)/.test(text) && text.includes('请假')) return '确认提交这条请假审批？'
  if (/(已签约|已流失|改成)/.test(text)) return '确认修改客户状态？'
  if (/(想咨询|录入)/.test(text) || /1[3-9]\d{9}/.test(text)) return '确认录入这条客户信息？'
  return null
}

function onComposerKey(event: KeyboardEvent | Event) {
  if (!('key' in event) || event.key !== 'Enter' || event.shiftKey) return
  if ('isComposing' in event && event.isComposing) return
  event.preventDefault()
  void send()
}

async function scrollLog() {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
}

async function reload() {
  loading.value = true
  try {
    const [briefData, leadData, dailyData, leaveData, progressData, ticketData] = await Promise.all([
      fetchBrief(),
      fetchLeads({ keyword: keyword.value || undefined, status: statusFilter.value || undefined }),
      fetchDailies(),
      fetchLeaves('pending'),
      fetchStudentProgress(progressStage.value || undefined),
      fetchStudentTickets(ticketStatus.value || undefined),
    ])
    brief.value = briefData
    leads.value = leadData.items
    dailies.value = dailyData.items
    leaves.value = leaveData.items
    studentProgress.value = progressData
    studentTickets.value = ticketData
  } finally {
    loading.value = false
  }
}

function fillHint(hint: string) {
  draft.value = hint
}

async function send(text?: string) {
  const query = (text ?? draft.value).trim()
  if (!query || sending.value) return
  const warn = writeConfirm(query)
  if (warn) {
    try {
      await ElMessageBox.confirm(query, warn, { type: 'warning' })
    } catch {
      return
    }
  }
  draft.value = ''
  messages.push({ role: 'user', text: query })
  messages.push({ role: 'assistant', text: '正在办理…', pending: true })
  sending.value = true
  void scrollLog()
  try {
    const result = await chat(query, conversationId.value)
    conversationId.value = result.conversation_id
    const last = messages[messages.length - 1]
    if (last?.pending) {
      last.pending = false
      last.text = result.reply
      last.intent = result.intent
      last.citation = result.citation
      last.payload = result.data
    }
    void scrollLog()
    const skipReload = ['kb', 'identity', 'help', 'brief', 'docs', 'faq', 'guide', 'memory', 'self_intro'].includes(
      result.intent || '',
    )
    if (!skipReload) void reload()
  } catch {
    const last = messages[messages.length - 1]
    if (last?.pending) {
      last.pending = false
      last.text = '暂时连不上助手，请稍后再试。'
      last.citation = '业务办理'
    }
  } finally {
    sending.value = false
  }
}

async function changeStatus(row: LeadItem, status: string) {
  try {
    if (status === 'signed') {
      await ElMessageBox.confirm(`将「${row.customer_name}」标记为已签约？`, '确认改状态')
    }
    let lost_reason: string | undefined
    if (status === 'lost') {
      const { value } = await ElMessageBox.prompt('流失原因', '标记流失', { inputPlaceholder: '必填' })
      lost_reason = String(value || '').trim()
      if (!lost_reason) return
    }
    if (status === 'contacting') {
      await ElMessageBox.confirm(`将「${row.customer_name}」改为跟进中？`, '确认改状态')
    }
    await updateLeadStatus(row.id, status, lost_reason)
    ElMessage.success('状态已更新')
    await reload()
  } catch {
    /* 取消 */
  }
}

async function decideLeave(row: Record<string, unknown>, action: 'approved' | 'rejected') {
  const name = String(row.student_name || '该同学')
  try {
    if (action === 'approved') {
      await ElMessageBox.confirm(`同意 ${name} 的请假？`, '确认审批')
      await approveLeave(Number(row.id), action)
    } else {
      const { value } = await ElMessageBox.prompt('驳回原因', `驳回 ${name} 的请假`, { inputPlaceholder: '必填' })
      const comment = String(value || '').trim()
      if (!comment) {
        ElMessage.warning('驳回需要填写原因')
        return
      }
      await approveLeave(Number(row.id), action, comment)
    }
    ElMessage.success(action === 'approved' ? '已通过' : '已驳回')
    await reload()
  } catch {
    /* 取消 */
  }
}

async function openLead(row: LeadItem) {
  currentLead.value = row
  drawer.value = true
  followDraft.value = ''
  const detail = await fetchLeadDetail(row.id)
  currentLead.value = detail.lead
  follows.value = detail.follow_ups || []
}

async function updateProgressRow(row: Record<string, unknown>, stage: string) {
  try {
    const { value } = await ElMessageBox.prompt('填写处理反馈', '更新申请进度', { inputValue: String(row.progress_detail || '') })
    await updateStudentProgress(Number(row.id), stage, String(value || '').trim(), String(row.next_action || '等待后续通知'))
    ElMessage.success('申请进度已更新')
    await reload()
  } catch { /* cancel */ }
}

async function handleTicketRow(row: Record<string, unknown>, action: string) {
  try {
    const { value } = await ElMessageBox.prompt(action === 'resolved' ? '填写解决方案' : '填写受理备注', action === 'resolved' ? '解决投诉' : '受理投诉', { inputValue: String(row.solution || '') })
    const solution = String(value || '').trim()
    if (action === 'resolved' && !solution) { ElMessage.warning('解决投诉必须填写解决方案'); return }
    await handleStudentTicket(Number(row.id), action, solution)
    ElMessage.success(action === 'resolved' ? '投诉已解决' : '投诉已受理')
    await reload()
  } catch { /* cancel */ }
}

async function saveFollow() {
  if (!currentLead.value || !followDraft.value.trim()) return
  followSaving.value = true
  try {
    await addFollowUp(currentLead.value.id, followDraft.value.trim())
    ElMessage.success('已记下跟进')
    followDraft.value = ''
    await openLead(currentLead.value)
    await reload()
  } finally {
    followSaving.value = false
  }
}

async function resetMemory() {
  try {
    await ElMessageBox.confirm('会清掉当前对话，客户表不会动。', '开始新对话', { type: 'warning' })
    await clearMemory()
    conversationId.value = null
    messages.splice(0, messages.length, {
      role: 'assistant',
      text: greetFrom(brief.value),
      citation: '业务办理',
    })
    ElMessage.success('已开始新对话')
  } catch {
    /* 取消 */
  }
}

watch(
  () => route.query.q,
  (value) => {
    if (value) draft.value = String(value)
  },
)

onMounted(async () => {
  try {
    const status = await fetchChatStatus()
    online.value = status.online !== false
  } catch {
    online.value = false
  }
  await reload()
  try {
    const memory = await fetchMemory()
    conversationId.value = memory.conversation_id
    if (memory.messages?.length) {
      messages.splice(
        0,
        messages.length,
        ...memory.messages.map((item) => {
          const role: ChatMsg['role'] = item.role === 'user' ? 'user' : 'assistant'
          const intent = item.intent || ''
          let citation: string | undefined
          if (role === 'assistant') {
            if (item.source === 'kb') citation = '知识库'
            else if (['memory', 'identity', 'self_intro'].includes(intent)) citation = '对话记忆'
            else citation = '业务办理'
          }
          return {
            role,
            text: item.content,
            intent,
            citation,
          }
        }),
      )
    } else {
      messages.splice(0, messages.length, {
        role: 'assistant',
        text: greetFrom(brief.value),
        citation: '业务办理',
      })
    }
    void scrollLog()
  } catch {
    messages.splice(0, messages.length, {
      role: 'assistant',
      text: greetFrom(brief.value),
      citation: '业务办理',
    })
  }
  if (route.query.q) draft.value = String(route.query.q)
})
</script>

<template>
  <section class="ent-page ent-chat">
    <header class="ent-head">
      <div>
        <h1>企业助手</h1>
        <p class="hint">口述录入、查客户、批请假、交日报。这轮对话会记住你说过的话，点「新对话」才清掉。</p>
      </div>
      <div class="head-actions">
        <el-tag :type="online ? 'success' : 'info'" effect="plain">已连接</el-tag>
        <el-button @click="resetMemory">新对话</el-button>
      </div>
    </header>

    <div class="ent-grid">
      <div class="chat-card">
        <div ref="logEl" class="chat-log">
          <div v-for="(msg, index) in messages" :key="index" class="bubble" :class="msg.role">
            <small v-if="msg.role === 'assistant' && msg.citation" class="src">{{ msg.citation }}</small>
            <p v-if="msg.pending" class="pending">正在办理…</p>
            <MarkdownText v-else :text="msg.text" />
            <el-collapse v-if="sqlOf(msg)" class="sql-fold">
              <el-collapse-item title="查看 SQL" name="sql">
                <pre class="sql-pre">{{ sqlOf(msg) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>
        <div class="chips">
          <el-button v-for="item in capabilities" :key="item.label" size="small" text bg @click="fillHint(item.hint)">
            {{ item.label }}
          </el-button>
        </div>
        <div class="composer">
          <el-input
            v-model="draft"
            type="textarea"
            :rows="3"
            placeholder="点上面的能力填例句，或直接说。回车发送，Shift+回车换行。"
            @keydown="onComposerKey"
          />
          <el-button type="primary" :loading="sending" @click="send()">发送</el-button>
        </div>
      </div>

      <div class="table-card">
        <el-tabs v-model="tab">
          <el-tab-pane label="意向客户" name="leads">
            <div class="toolbar">
              <el-input v-model="keyword" placeholder="姓名 / 电话" clearable style="width: 180px" @keyup.enter="reload" />
              <el-select v-model="statusFilter" clearable placeholder="状态" style="width: 140px" @change="reload">
                <el-option label="新线索" value="new" />
                <el-option label="跟进中" value="contacting" />
                <el-option label="已合格" value="qualified" />
                <el-option label="已签约" value="signed" />
                <el-option label="已流失" value="lost" />
              </el-select>
              <el-button :loading="loading" @click="reload">筛选</el-button>
            </div>
            <el-table :data="leads" size="small" height="480" @row-click="openLead">
              <el-table-column prop="customer_name" label="客户" width="90" />
              <el-table-column prop="contact_info" label="电话" width="120" />
              <el-table-column prop="intended_country" label="意向" width="90" />
              <el-table-column prop="status_text" label="状态" width="90" />
              <el-table-column label="操作" min-width="180">
                <template #default="scope">
                  <el-button link type="primary" @click.stop="changeStatus(scope.row as LeadItem, 'signed')">签约</el-button>
                  <el-button link type="danger" @click.stop="changeStatus(scope.row as LeadItem, 'lost')">流失</el-button>
                  <el-button link @click.stop="changeStatus(scope.row as LeadItem, 'contacting')">跟进中</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="日报" name="dailies">
            <el-table :data="dailies" size="small" height="480">
              <el-table-column prop="employee_name" label="员工" width="90" />
              <el-table-column prop="report_date" label="日期" width="120" />
              <el-table-column label="进展" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">{{ joinField(row.key_progress) }}</template>
              </el-table-column>
              <el-table-column label="问题" min-width="120" show-overflow-tooltip>
                <template #default="{ row }">{{ joinField(row.risks) }}</template>
              </el-table-column>
              <el-table-column label="计划" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">{{ row.next_plan || '—' }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="请假审批" name="leaves">
            <el-table :data="leaves" size="small" height="480">
              <el-table-column prop="student_name" label="学生" width="90" />
              <el-table-column prop="leave_type" label="类型" width="90" />
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ fmtTime(row.start_time) }} ~ {{ fmtTime(row.end_time) }}</template>
              </el-table-column>
              <el-table-column prop="reason" label="事由" />
              <el-table-column label="操作" width="140">
                <template #default="{ row }">
                  <el-button link type="primary" @click="decideLeave(row, 'approved')">同意</el-button>
                  <el-button link type="danger" @click="decideLeave(row, 'rejected')">驳回</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="学生申请" name="progress"><div class="toolbar"><el-select v-model="progressStage" clearable placeholder="申请阶段" style="width: 150px" @change="reload"><el-option label="已提交" value="submitted" /><el-option label="材料准备" value="document_prep" /><el-option label="院校审核中" value="under_review" /><el-option label="已录取" value="offer_received" /><el-option label="签证办理中" value="visa_processing" /></el-select><el-button @click="reload">刷新</el-button></div><el-table :data="studentProgress" size="small" height="480"><el-table-column prop="student_name" label="学生" width="90" /><el-table-column prop="target_school" label="目标院校" min-width="140" /><el-table-column prop="target_major" label="专业" min-width="110" /><el-table-column prop="stage" label="阶段" width="120" /><el-table-column prop="progress_detail" label="进度说明" min-width="180" show-overflow-tooltip /><el-table-column label="操作" width="190"><template #default="{ row }"><el-button link type="primary" @click="updateProgressRow(row, 'under_review')">受理</el-button><el-button link type="success" @click="updateProgressRow(row, 'offer_received')">录取</el-button><el-button link type="warning" @click="updateProgressRow(row, 'visa_processing')">签证</el-button></template></el-table-column></el-table></el-tab-pane>
          <el-tab-pane label="投诉反馈" name="tickets"><div class="toolbar"><el-select v-model="ticketStatus" clearable placeholder="工单状态" style="width: 150px" @change="reload"><el-option label="待处理" value="pending" /><el-option label="处理中" value="processing" /><el-option label="已解决" value="resolved" /></el-select><el-button @click="reload">刷新</el-button></div><el-table :data="studentTickets" size="small" height="480"><el-table-column prop="student_name" label="学生" width="90" /><el-table-column prop="title" label="标题" min-width="160" /><el-table-column prop="category" label="分类" width="100" /><el-table-column prop="status_text" label="状态" width="90" /><el-table-column prop="content" label="问题描述" min-width="180" show-overflow-tooltip /><el-table-column label="操作" width="190"><template #default="{ row }"><el-button v-if="row.status === 'pending'" link type="primary" @click="handleTicketRow(row, 'processing')">受理</el-button><el-button v-if="row.status === 'pending' || row.status === 'processing'" link type="success" @click="handleTicketRow(row, 'resolved')">解决</el-button></template></el-table-column></el-table></el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <el-drawer v-model="drawer" :title="currentLead?.customer_name || '客户跟进'" size="420px">
      <p v-if="currentLead" class="hint">
        {{ currentLead.contact_info || '无电话' }} · {{ currentLead.intended_country || '意向未填' }} ·
        {{ currentLead.status_text }}
      </p>
      <el-timeline v-if="follows.length">
        <el-timeline-item v-for="item in follows" :key="item.id" :timestamp="fmtTime(item.create_time)">
          {{ item.content }}
          <div v-if="item.next_plan" class="muted">下一步：{{ item.next_plan }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="还没有跟进记录" :image-size="64" />
      <el-input v-model="followDraft" type="textarea" :rows="3" placeholder="补一句跟进，例如：今天下午通了电话" />
      <el-button class="follow-save" type="primary" :loading="followSaving" @click="saveFollow">记一笔跟进</el-button>
    </el-drawer>
  </section>
</template>
