import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Collapse, Drawer, Empty, Input, Select, Table, Tabs, Tag, Timeline } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { MarkdownText } from '@/components/MarkdownText'
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
  fetchMemory,
  fetchStudentProgress,
  fetchStudentTickets,
  handleStudentTicket,
  updateLeadStatus,
  updateStudentProgress,
  type FollowUpItem,
  type LeadItem,
} from '@/api/enterprise'
import { confirmBox, promptBox, toast } from '@/components/feedback'
import './EnterprisePage.css'

// 等价迁移自 Vue 版 views/enterprise/index.vue(对话工作台 + 5 类业务 Tab)。
// 右栏第一个「概览」Tab 是 React 超集区块(顶部 4 指标卡 + 漏斗条),Vue 无此区块,数据调用沿用原实现。

type ChatMsg = {
  role: 'user' | 'assistant'
  text: string
  intent?: string
  citation?: string
  payload?: Record<string, unknown>
  pending?: boolean
}

type TabKey = 'overview' | 'leads' | 'dailies' | 'leaves' | 'progress' | 'tickets'

const capabilities = [
  { label: '录入客户', hint: '张三 13800138000 想咨询美国硕士' },
  { label: '今日待办', hint: '我今天有什么待办？' },
  { label: '入职指引', hint: '打印机在几楼？坏了找谁？' },
  { label: '批请假', hint: '同意张三的请假' },
]

const statusOptions = [
  { label: '新线索', value: 'new' },
  { label: '跟进中', value: 'contacting' },
  { label: '已合格', value: 'qualified' },
  { label: '已签约', value: 'signed' },
  { label: '已流失', value: 'lost' },
]

const stageOptions = [
  { label: '已提交', value: 'submitted' },
  { label: '材料准备', value: 'document_prep' },
  { label: '院校审核中', value: 'under_review' },
  { label: '已录取', value: 'offer_received' },
  { label: '签证办理中', value: 'visa_processing' },
]

const ticketStatusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已解决', value: 'resolved' },
]

// el-button link 的 EP 文本色(primary 已被主题覆盖为 #c41e1e)
const EP_LINK: Record<'primary' | 'danger' | 'success' | 'warning' | 'default', string> = {
  primary: '#c41e1e',
  danger: '#f56c6c',
  success: '#67c23a',
  warning: '#e6a23c',
  default: '#606266',
}

// EP el-tag effect="plain" 的色值(success / info)
const TAG_PLAIN_ONLINE = { color: '#67c23a', background: '#f0f9eb', borderColor: '#e1f3d8' }
const TAG_PLAIN_OFFLINE = { color: '#909399', background: '#f4f4f5', borderColor: '#e9e9eb' }

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

/** el-button link 等价(EP 文本色 + 无内边距,外层用 .lead-actions 排列) */
function LinkButton({
  tone = 'default',
  onClick,
  children,
}: {
  tone?: keyof typeof EP_LINK
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  return (
    <Button type="link" size="small" style={{ color: EP_LINK[tone], padding: 0, height: 'auto' }} onClick={onClick}>
      {children}
    </Button>
  )
}

export function EnterprisePage() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [online, setOnline] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tab, setTab] = useState<TabKey>('overview')
  const [draft, setDraft] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [brief, setBrief] = useState<Record<string, unknown>>({})
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [total, setTotal] = useState(0)
  const [dailies, setDailies] = useState<Record<string, unknown>[]>([])
  const [leaves, setLeaves] = useState<Record<string, unknown>[]>([])
  const [studentProgress, setStudentProgress] = useState<Record<string, unknown>[]>([])
  const [progressStage, setProgressStage] = useState('')
  const [studentTickets, setStudentTickets] = useState<Record<string, unknown>[]>([])
  const [ticketStatus, setTicketStatus] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [drawer, setDrawer] = useState(false)
  const [currentLead, setCurrentLead] = useState<LeadItem | null>(null)
  const [follows, setFollows] = useState<FollowUpItem[]>([])
  const [followDraft, setFollowDraft] = useState('')
  const [followSaving, setFollowSaving] = useState(false)
  const logEl = useRef<HTMLDivElement | null>(null)

  // Vue 的 reload 读 ref;React 里 Select onChange 触发时 state 还未提交,用入参覆盖
  async function reload(override?: {
    keyword?: string
    status?: string
    progressStage?: string
    ticketStatus?: string
  }) {
    const nextKeyword = override?.keyword ?? keyword
    const nextStatus = override?.status ?? statusFilter
    const nextStage = override?.progressStage ?? progressStage
    const nextTickets = override?.ticketStatus ?? ticketStatus
    setLoading(true)
    try {
      const [briefData, leadData, dailyData, leaveData, progressData, ticketData] = await Promise.all([
        fetchBrief(),
        fetchLeads({ keyword: nextKeyword || undefined, status: nextStatus || undefined }),
        fetchDailies(),
        fetchLeaves('pending'),
        fetchStudentProgress(nextStage || undefined),
        fetchStudentTickets(nextTickets || undefined),
      ])
      setBrief(briefData)
      setLeads(leadData.items)
      setTotal(leadData.total)
      setDailies(dailyData.items)
      setLeaves(leaveData.items)
      setStudentProgress(progressData)
      setStudentTickets(ticketData)
      return briefData
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const status = await fetchChatStatus()
        setOnline(status.online !== false)
      } catch {
        setOnline(false)
      }
      let briefData: Record<string, unknown> | null = null
      try {
        // Vue:onMounted 里 reload 抛错会中断后续(不拉记忆、不问候)
        briefData = await reload()
      } catch {
        return
      }
      try {
        const memory = await fetchMemory()
        setConversationId(memory.conversation_id)
        if (memory.messages?.length) {
          setMessages(
            memory.messages.map((item) => {
              const role: ChatMsg['role'] = item.role === 'user' ? 'user' : 'assistant'
              const intent = item.intent || ''
              let citation: string | undefined
              if (role === 'assistant') {
                if (item.source === 'kb') citation = '知识库'
                else if (['memory', 'identity', 'self_intro'].includes(intent)) citation = '对话记忆'
                else citation = '业务办理'
              }
              return { role, text: item.content, intent, citation }
            }),
          )
        } else {
          setMessages([{ role: 'assistant', text: greetFrom(briefData || brief), citation: '业务办理' }])
        }
      } catch {
        setMessages([{ role: 'assistant', text: greetFrom(briefData || brief), citation: '业务办理' }])
      }
      if (searchParams.get('q')) setDraft(String(searchParams.get('q')))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 等价 Vue 的 watch(() => route.query.q):guide 页带 q 进来时预填输入框
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setDraft(q)
  }, [searchParams])

  // 等价 Vue 的 scrollLog(nextTick 后滚到底)
  useEffect(() => {
    if (logEl.current) logEl.current.scrollTop = logEl.current.scrollHeight
  }, [messages])

  function fillHint(hint: string) {
    setDraft(hint)
  }

  function onComposerKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }

  async function send(text?: string) {
    const query = (text ?? draft).trim()
    if (!query || sending) return
    const warn = writeConfirm(query)
    if (warn) {
      const ok = await confirmBox({ title: warn, content: query })
      if (!ok) return
    }
    setDraft('')
    setSending(true)
    setMessages((items) => [...items, { role: 'user', text: query }, { role: 'assistant', text: '正在办理…', pending: true }])
    try {
      const result = await chat(query, conversationId)
      setConversationId(result.conversation_id)
      setMessages((items) =>
        items.map((item, index) =>
          index === items.length - 1 && item.pending
            ? { ...item, pending: false, text: result.reply, intent: result.intent, citation: result.citation, payload: result.data }
            : item,
        ),
      )
      const skipReload = ['kb', 'identity', 'help', 'brief', 'docs', 'faq', 'guide', 'memory', 'self_intro'].includes(
        result.intent || '',
      )
      if (!skipReload) void reload()
    } catch {
      setMessages((items) =>
        items.map((item, index) =>
          index === items.length - 1 && item.pending
            ? { ...item, pending: false, text: '暂时连不上助手，请稍后再试。', citation: '业务办理' }
            : item,
        ),
      )
    } finally {
      setSending(false)
    }
  }

  async function changeStatus(row: LeadItem, status: string) {
    try {
      if (status === 'signed') {
        const ok = await confirmBox({ title: '确认改状态', content: `将「${row.customer_name}」标记为已签约？` })
        if (!ok) return
      }
      let lost_reason: string | undefined
      if (status === 'lost') {
        const value = await promptBox({ title: '标记流失', content: '流失原因', placeholder: '必填' })
        if (value === null) return
        lost_reason = value.trim()
        if (!lost_reason) return
      }
      if (status === 'contacting') {
        const ok = await confirmBox({ title: '确认改状态', content: `将「${row.customer_name}」改为跟进中？` })
        if (!ok) return
      }
      await updateLeadStatus(row.id, status, lost_reason)
      toast.success('状态已更新')
      await reload()
    } catch {
      /* 取消 */
    }
  }

  async function decideLeave(row: Record<string, unknown>, action: 'approved' | 'rejected') {
    const name = String(row.student_name || '该同学')
    try {
      if (action === 'approved') {
        const ok = await confirmBox({ title: '确认审批', content: `同意 ${name} 的请假？` })
        if (!ok) return
        await approveLeave(Number(row.id), action)
      } else {
        // Vue:prompt 空值 → ElMessage.warning('驳回需要填写原因');promptBox 用 emptyHint 拦截并沿用同一文案
        const comment = await promptBox({
          title: `驳回 ${name} 的请假`,
          content: '驳回原因',
          placeholder: '必填',
          emptyHint: '驳回需要填写原因',
        })
        if (comment === null) return
        await approveLeave(Number(row.id), action, comment)
      }
      toast.success(action === 'approved' ? '已通过' : '已驳回')
      await reload()
    } catch {
      /* 取消 */
    }
  }

  async function openLead(row: LeadItem) {
    setCurrentLead(row)
    setDrawer(true)
    setFollowDraft('')
    const detail = await fetchLeadDetail(row.id)
    setCurrentLead(detail.lead)
    setFollows(detail.follow_ups || [])
  }

  async function updateProgressRow(row: Record<string, unknown>, stage: string) {
    try {
      // TODO(迁移): promptBox 不支持 Vue 的 inputValue 预填(Vue 预填 progress_detail)
      const value = await promptBox({ title: '更新申请进度', content: '填写处理反馈' })
      if (value === null) return
      await updateStudentProgress(Number(row.id), stage, value.trim(), String(row.next_action || '等待后续通知'))
      toast.success('申请进度已更新')
      await reload()
    } catch {
      /* cancel */
    }
  }

  async function handleTicketRow(row: Record<string, unknown>, action: string) {
    try {
      // TODO(迁移): promptBox 不支持 Vue 的 inputValue 预填(Vue 预填 solution);且 Vue 受理时允许空备注
      const value = await promptBox({
        title: action === 'resolved' ? '解决投诉' : '受理投诉',
        content: action === 'resolved' ? '填写解决方案' : '填写受理备注',
        emptyHint: '解决投诉必须填写解决方案',
      })
      if (value === null) return
      const solution = value.trim()
      if (action === 'resolved' && !solution) {
        toast.warning('解决投诉必须填写解决方案')
        return
      }
      await handleStudentTicket(Number(row.id), action, solution)
      toast.success(action === 'resolved' ? '投诉已解决' : '投诉已受理')
      await reload()
    } catch {
      /* cancel */
    }
  }

  async function saveFollow() {
    if (!currentLead || !followDraft.trim()) return
    setFollowSaving(true)
    try {
      await addFollowUp(currentLead.id, followDraft.trim())
      toast.success('已记下跟进')
      setFollowDraft('')
      await openLead(currentLead)
      await reload()
    } finally {
      setFollowSaving(false)
    }
  }

  async function resetMemory() {
    const ok = await confirmBox({ title: '开始新对话', content: '会清掉当前对话，客户表不会动。' })
    if (!ok) return
    await clearMemory()
    setConversationId(null)
    setMessages([{ role: 'assistant', text: greetFrom(brief), citation: '业务办理' }])
    toast.success('已开始新对话')
  }

  const leadColumns: ColumnsType<LeadItem> = [
    { title: '客户', dataIndex: 'customer_name', width: 90 },
    { title: '电话', dataIndex: 'contact_info', width: 120 },
    { title: '意向', dataIndex: 'intended_country', width: 90 },
    { title: '状态', dataIndex: 'status_text', width: 90 },
    {
      title: '操作',
      width: 180,
      render: (_, row) => (
        <div className="lead-actions">
          <LinkButton tone="primary" onClick={(event) => { event.stopPropagation(); void changeStatus(row, 'signed') }}>
            签约
          </LinkButton>
          <LinkButton tone="danger" onClick={(event) => { event.stopPropagation(); void changeStatus(row, 'lost') }}>
            流失
          </LinkButton>
          <LinkButton onClick={(event) => { event.stopPropagation(); void changeStatus(row, 'contacting') }}>
            跟进中
          </LinkButton>
        </div>
      ),
    },
  ]

  const dailyColumns: ColumnsType<Record<string, unknown>> = [
    { title: '员工', dataIndex: 'employee_name', width: 90 },
    { title: '日期', dataIndex: 'report_date', width: 120 },
    { title: '进展', render: (_, row) => joinField(row.key_progress), ellipsis: true },
    { title: '问题', render: (_, row) => joinField(row.risks), ellipsis: true },
    { title: '计划', render: (_, row) => String(row.next_plan || '—'), ellipsis: true },
  ]

  const leaveColumns: ColumnsType<Record<string, unknown>> = [
    { title: '学生', dataIndex: 'student_name', width: 90 },
    { title: '类型', dataIndex: 'leave_type', width: 90 },
    { title: '时间', width: 170, render: (_, row) => `${fmtTime(row.start_time)} ~ ${fmtTime(row.end_time)}` },
    { title: '事由', dataIndex: 'reason' },
    {
      title: '操作',
      width: 140,
      render: (_, row) => (
        <div className="lead-actions">
          <LinkButton tone="primary" onClick={() => void decideLeave(row, 'approved')}>同意</LinkButton>
          <LinkButton tone="danger" onClick={() => void decideLeave(row, 'rejected')}>驳回</LinkButton>
        </div>
      ),
    },
  ]

  const progressColumns: ColumnsType<Record<string, unknown>> = [
    { title: '学生', dataIndex: 'student_name', width: 90 },
    { title: '目标院校', dataIndex: 'target_school', ellipsis: true },
    { title: '专业', dataIndex: 'target_major', ellipsis: true },
    { title: '阶段', dataIndex: 'stage', width: 120 },
    { title: '进度说明', dataIndex: 'progress_detail', ellipsis: true },
    {
      title: '操作',
      width: 190,
      render: (_, row) => (
        <div className="lead-actions">
          <LinkButton tone="primary" onClick={() => void updateProgressRow(row, 'under_review')}>受理</LinkButton>
          <LinkButton tone="success" onClick={() => void updateProgressRow(row, 'offer_received')}>录取</LinkButton>
          <LinkButton tone="warning" onClick={() => void updateProgressRow(row, 'visa_processing')}>签证</LinkButton>
        </div>
      ),
    },
  ]

  const ticketColumns: ColumnsType<Record<string, unknown>> = [
    { title: '学生', dataIndex: 'student_name', width: 90 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '状态', dataIndex: 'status_text', width: 90 },
    { title: '问题描述', dataIndex: 'content', ellipsis: true },
    {
      title: '操作',
      width: 190,
      render: (_, row) => (
        <div className="lead-actions">
          {row.status === 'pending' ? (
            <LinkButton tone="primary" onClick={() => void handleTicketRow(row, 'processing')}>受理</LinkButton>
          ) : null}
          {row.status === 'pending' || row.status === 'processing' ? (
            <LinkButton tone="success" onClick={() => void handleTicketRow(row, 'resolved')}>解决</LinkButton>
          ) : null}
        </div>
      ),
    },
  ]

  const funnel = (brief.funnel || {}) as Record<string, number>

  const tabItems = [
    {
      key: 'overview',
      label: '概览',
      children: (
        <div className="ent-overview">
          <div className="stat-row ent-overview-stats">
            <article className="stat-card">
              <small>客户总数</small>
              <strong>{total}</strong>
            </article>
            <article className="stat-card">
              <small>待办事项</small>
              <strong>{Number(brief.pending_todos || 0)}</strong>
            </article>
            <article className="stat-card">
              <small>待审批请假</small>
              <strong>{Number(brief.pending_leave_approvals || 0)}</strong>
            </article>
            <article className="stat-card">
              <small>待处理投诉</small>
              <strong>{Number(brief.pending_tickets || 0)}</strong>
            </article>
          </div>
          <div className="ent-overview-funnel">
            <h3>客户漏斗</h3>
            <div className="funnel-items">
              {statusOptions.map((item) => (
                <span key={item.value}>
                  <b>{funnel[item.value] ?? 0}</b>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'leads',
      label: '意向客户',
      children: (
        <>
          <div className="toolbar">
            <Input
              value={keyword}
              allowClear
              placeholder="姓名 / 电话"
              style={{ width: 180 }}
              onChange={(event) => setKeyword(event.target.value)}
              onPressEnter={() => void reload()}
            />
            <Select
              value={statusFilter || undefined}
              allowClear
              placeholder="状态"
              style={{ width: 140 }}
              options={statusOptions}
              onChange={(value) => {
                setStatusFilter(value || '')
                void reload({ status: value || '' })
              }}
            />
            <Button loading={loading} onClick={() => void reload()}>
              筛选
            </Button>
          </div>
          <Table
            rowKey="id"
            size="small"
            columns={leadColumns}
            dataSource={leads}
            pagination={false}
            scroll={{ y: 480 }}
            onRow={(row) => ({ onClick: () => void openLead(row) })}
          />
        </>
      ),
    },
    {
      key: 'dailies',
      label: '日报',
      children: (
        <Table
          rowKey={(_, index) => String(index)}
          size="small"
          columns={dailyColumns}
          dataSource={dailies}
          pagination={false}
          scroll={{ y: 480 }}
        />
      ),
    },
    {
      key: 'leaves',
      label: '请假审批',
      children: (
        <Table
          rowKey={(_, index) => String(index)}
          size="small"
          columns={leaveColumns}
          dataSource={leaves}
          pagination={false}
          scroll={{ y: 480 }}
        />
      ),
    },
    {
      key: 'progress',
      label: '学生申请',
      children: (
        <>
          <div className="toolbar">
            <Select
              value={progressStage || undefined}
              allowClear
              placeholder="申请阶段"
              style={{ width: 150 }}
              options={stageOptions}
              onChange={(value) => {
                setProgressStage(value || '')
                void reload({ progressStage: value || '' })
              }}
            />
            <Button onClick={() => void reload()}>刷新</Button>
          </div>
          <Table
            rowKey={(_, index) => String(index)}
            size="small"
            columns={progressColumns}
            dataSource={studentProgress}
            pagination={false}
            scroll={{ y: 480 }}
          />
        </>
      ),
    },
    {
      key: 'tickets',
      label: '投诉反馈',
      children: (
        <>
          <div className="toolbar">
            <Select
              value={ticketStatus || undefined}
              allowClear
              placeholder="工单状态"
              style={{ width: 150 }}
              options={ticketStatusOptions}
              onChange={(value) => {
                setTicketStatus(value || '')
                void reload({ ticketStatus: value || '' })
              }}
            />
            <Button onClick={() => void reload()}>刷新</Button>
          </div>
          <Table
            rowKey={(_, index) => String(index)}
            size="small"
            columns={ticketColumns}
            dataSource={studentTickets}
            pagination={false}
            scroll={{ y: 480 }}
          />
        </>
      ),
    },
  ]

  return (
    <section className="ent-page ent-chat">
      <header className="ent-head">
        <div>
          <h1>企业助手</h1>
          <p className="hint">口述录入、查客户、批请假、交日报。这轮对话会记住你说过的话，点「新对话」才清掉。</p>
        </div>
        <div className="head-actions">
          <Tag style={online ? TAG_PLAIN_ONLINE : TAG_PLAIN_OFFLINE}>已连接</Tag>
          <Button onClick={() => void resetMemory()}>新对话</Button>
        </div>
      </header>

      <div className="ent-grid">
        <div className="chat-card">
          <div ref={logEl} className="chat-log">
            {messages.map((msg, index) => (
              <div key={index} className={`bubble ${msg.role}`}>
                {msg.role === 'assistant' && msg.citation ? <small className="src">{msg.citation}</small> : null}
                {msg.pending ? <p className="pending">正在办理…</p> : <MarkdownText text={msg.text} />}
                {sqlOf(msg) ? (
                  <Collapse
                    className="sql-fold"
                    items={[{ key: 'sql', label: '查看 SQL', children: <pre className="sql-pre">{sqlOf(msg)}</pre> }]}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <div className="chips">
            {capabilities.map((item) => (
              <Button key={item.label} size="small" color="default" variant="filled" onClick={() => fillHint(item.hint)}>
                {item.label}
              </Button>
            ))}
          </div>
          <div className="composer">
            <Input.TextArea
              value={draft}
              rows={3}
              placeholder="点上面的能力填例句，或直接说。回车发送，Shift+回车换行。"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKey}
            />
            <Button type="primary" loading={sending} onClick={() => void send()}>
              发送
            </Button>
          </div>
        </div>

        <div className="table-card">
          <Tabs activeKey={tab} onChange={(key) => setTab(key as TabKey)} items={tabItems} />
        </div>
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title={currentLead?.customer_name || '客户跟进'}
        size={420}
        destroyOnHidden
      >
        {currentLead ? (
          <p className="hint">
            {currentLead.contact_info || '无电话'} · {currentLead.intended_country || '意向未填'} ·{' '}
            {currentLead.status_text}
          </p>
        ) : null}
        {follows.length ? (
          <Timeline
            items={follows.map((item) => ({
              key: item.id,
              content: (
                <>
                  {item.content}
                  {item.next_plan ? <div className="muted">下一步：{item.next_plan}</div> : null}
                  <div className="timeline-time">{fmtTime(item.create_time)}</div>
                </>
              ),
            }))}
          />
        ) : (
          <Empty description="还没有跟进记录" styles={{ image: { height: 64 } }} />
        )}
        <Input.TextArea
          value={followDraft}
          rows={3}
          placeholder="补一句跟进，例如：今天下午通了电话"
          onChange={(event) => setFollowDraft(event.target.value)}
        />
        <Button className="follow-save" type="primary" loading={followSaving} onClick={() => void saveFollow()}>
          记一笔跟进
        </Button>
      </Drawer>
    </section>
  )
}
