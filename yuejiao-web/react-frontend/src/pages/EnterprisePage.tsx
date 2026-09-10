import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle, Check, Clock3, Database, FileText, LoaderCircle, Plus, RefreshCw,
  Search, Send, Sparkles, UserRound, UsersRound, X,
} from 'lucide-react'
import { addFollowUp, approveLeave, chat, clearMemory, fetchBrief, fetchChatStatus, fetchDailies, fetchLeadDetail, fetchLeads, fetchLeaves, fetchMemory, fetchStudentProgress, fetchStudentTickets, handleStudentTicket, updateLeadStatus, updateStudentProgress, type FollowUpItem, type LeadItem, type MemorySnapshot } from '@/api/enterprise'
import type { ChatResult } from '@/api/enterprise'
import { MarkdownText } from '@/components/MarkdownText'
import { PageHeader, Panel, StatCard, Button, Badge, LiveDot, Tabs, Drawer, Empty, Modal, Input, Select, Textarea, showToast, useConfirm } from '@/ui'
import './enterprise.css'

type ChatMsg = { role: 'user' | 'assistant'; text: string; intent?: string; citation?: string; data?: Record<string, unknown>; pending?: boolean }
type Tab = 'leads' | 'dailies' | 'leaves' | 'progress' | 'tickets' | 'memory'

const statusLabels: Record<string, string> = { new: '新线索', contacting: '跟进中', qualified: '已合格', signed: '已签约', lost: '已流失' }
const statusTones: Record<string, 'info' | 'warning' | 'violet' | 'success' | 'neutral'> = { new: 'info', contacting: 'warning', qualified: 'violet', signed: 'success', lost: 'neutral' }
const capabilities = [
  { label: '录入客户', hint: '张三 13800138000 想咨询美国硕士' },
  { label: '查跟进', hint: '查一下李四最近跟进记录' },
  { label: '改状态', hint: '把李四改成已签约' },
  { label: '今日待办', hint: '我今天有什么待办？' },
]

function formatTime(value: unknown) { return value ? String(value).replace('T', ' ').slice(0, 16) : '—' }
function statusBadge(lead: LeadItem) {
  return <Badge tone={statusTones[lead.status] || 'neutral'} dot>{lead.status_text || statusLabels[lead.status] || lead.status}</Badge>
}

function joinField(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join('；') || '—'
  if (value) return String(value)
  return '—'
}

// 照搬旧版 greetFrom:用 brief 生成带姓名与待办统计的个性化问候
function greetFrom(data: Record<string, unknown>) {
  const name = String(data.employee_name || '你好')
  return `${name}，待办 ${data.pending_todos ?? 0} 条，待审批请假 ${data.pending_leave_approvals ?? 0} 条，待处理投诉 ${data.pending_tickets ?? 0} 条。可以直接说客户，或点下面的能力。`
}

// 照搬旧版 sqlOf:NL2SQL 命中时消息 payload 会带 sql
function sqlOf(message: ChatMsg) {
  const sql = message.data?.sql
  return typeof sql === 'string' ? sql.trim() : ''
}

// 照搬旧版 writeConfirm:写操作指令发送前给出针对性的确认文案
function writeConfirmText(text: string) {
  if (/(同意|批准|通过|拒绝|驳回)/.test(text) && text.includes('请假')) return '确认提交这条请假审批？'
  if (/(已签约|已流失|改成)/.test(text)) return '确认修改客户状态？'
  if (/(想咨询|录入)/.test(text) || /1[3-9]\d{9}/.test(text)) return '确认录入这条客户信息？'
  return null
}

// 照搬旧版引用推断:历史消息回放时的来源标注
function citationOf(intent: string, source?: string | null) {
  if (source === 'kb') return '知识库'
  if (['memory', 'identity', 'self_intro'].includes(intent)) return '对话记忆'
  return '业务办理'
}

function Spark() { return <span className="spark-icon"><span /><span /><span /></span> }

export function EnterprisePage() {
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState('')
  const [brief, setBrief] = useState<Record<string, unknown>>({})
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [total, setTotal] = useState(0)
  const [dailies, setDailies] = useState<Record<string, unknown>[]>([])
  const [leaves, setLeaves] = useState<Record<string, unknown>[]>([])
  const [studentProgress, setStudentProgress] = useState<Record<string, unknown>[]>([])
  const [progressStage, setProgressStage] = useState('')
  const [studentTickets, setStudentTickets] = useState<Record<string, unknown>[]>([])
  const [ticketStatus, setTicketStatus] = useState('')
  const [memory, setMemory] = useState<MemorySnapshot | null>(null)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tab, setTab] = useState<Tab>('leads')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ lead: LeadItem; follow_ups: FollowUpItem[] } | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [followDraft, setFollowDraft] = useState('')
  const [followSaving, setFollowSaving] = useState(false)
  const [progressEdit, setProgressEdit] = useState<Record<string, unknown> | null>(null)
  const [progressDraft, setProgressDraft] = useState({ stage: 'under_review', content: '', nextPlan: '' })
  const [ticketEdit, setTicketEdit] = useState<{ row: Record<string, unknown>; action: 'processing' | 'resolved' } | null>(null)
  const [ticketSolution, setTicketSolution] = useState('')
  const [actionSaving, setActionSaving] = useState(false)
  const [statusEdit, setStatusEdit] = useState<LeadItem | null>(null)
  const [lostReason, setLostReason] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [leaveReject, setLeaveReject] = useState<Record<string, unknown> | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  // 记忆回放后不再用问候语覆盖对话区
  const chatHydrated = useRef(false)

  async function reload() {
    setLoading(true); setError('')
    try {
      const [briefData, leadData, dailyData, leaveData, progressData, ticketData] = await Promise.all([
        fetchBrief(), fetchLeads({ keyword: keyword || undefined, status: statusFilter || undefined }), fetchDailies(), fetchLeaves('pending'),
        fetchStudentProgress(progressStage || undefined), fetchStudentTickets(ticketStatus || undefined),
      ])
      setBrief(briefData); setLeads(leadData.items); setTotal(leadData.total); setDailies(dailyData.items); setLeaves(leaveData.items)
      setStudentProgress(progressData); setStudentTickets(ticketData)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '数据加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { void reload() }, [keyword, statusFilter, progressStage, ticketStatus])
  useEffect(() => {
    void fetchChatStatus().then((status) => setOnline(status.online !== false)).catch(() => setOnline(false))
    // 照搬旧版:拉记忆并回放到对话区(带引用标注);新版同时把快照给「对话记忆」Tab 用
    void fetchMemory()
      .then((snapshot) => {
        setMemory(snapshot)
        if (snapshot.messages?.length) {
          chatHydrated.current = true
          setMessages(
            snapshot.messages.map((item) => ({
              role: item.role === 'user' ? 'user' as const : 'assistant' as const,
              text: item.content,
              intent: item.intent || undefined,
              citation: item.role === 'user' ? undefined : citationOf(item.intent || '', item.source),
            })),
          )
        }
      })
      .catch(() => setMemory(null))
  }, [])

  // 照搬旧版:无历史时用 brief 生成个性化问候(brief 由 reload 拉回,employee_name 到位才算就绪)
  useEffect(() => {
    if (chatHydrated.current || messages.length) return
    if (!brief.employee_name) return
    setMessages([{ role: 'assistant', text: greetFrom(brief), citation: '业务办理' }])
  }, [brief, messages])

  // 等价旧版的 watch(route.query.q):guide 页带 ?q= 进来时预填输入框
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setDraft(q)
  }, [searchParams])

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [messages])

  async function send(text?: string) {
    const query = (text ?? draft).trim()
    if (!query || sending) return
    // 照搬旧版 writeConfirm:按指令类型给出针对性确认文案
    const warn = writeConfirmText(query)
    if (warn) {
      const ok = await confirm({ title: warn, description: `「${query}」会直接作用在业务数据上。`, confirmText: '执行' })
      if (!ok) return
    }
    setDraft(''); setSending(true)
    setMessages((items) => [...items, { role: 'user', text: query }, { role: 'assistant', text: '正在办理…', pending: true }])
    try {
      const result: ChatResult = await chat(query, conversationId)
      setConversationId(result.conversation_id)
      setMessages((items) => items.map((item, index) => index === items.length - 1 ? { role: 'assistant', text: result.reply, intent: result.intent, citation: result.citation, data: result.data } : item))
      if (!['kb', 'identity', 'help', 'brief', 'docs', 'faq', 'guide', 'memory', 'self_intro'].includes(result.intent || '')) await reload()
    } catch (cause) {
      setMessages((items) => items.map((item, index) => index === items.length - 1 ? { role: 'assistant', text: cause instanceof Error ? cause.message : '暂时连不上助手，请稍后重试。', citation: '业务办理' } : item))
    } finally { setSending(false) }
  }

  async function openLead(lead: LeadItem) {
    try { setDetail(await fetchLeadDetail(lead.id)); setDetailOpen(true) } catch (cause) { setError(cause instanceof Error ? cause.message : '客户详情加载失败') }
  }

  // 照搬旧版 changeStatus:签约/跟进中需确认,流失需填原因(改用 Modal 收集)
  async function changeStatus(lead: LeadItem, status: 'signed' | 'contacting') {
    const ok = await confirm({
      title: status === 'signed' ? `将「${lead.customer_name}」标记为已签约？` : `将「${lead.customer_name}」改为跟进中？`,
      description: '状态变更会同步到客户看板与跟进记录。',
      confirmText: '确认',
    })
    if (!ok) return
    try {
      await updateLeadStatus(lead.id, status)
      showToast('状态已更新')
      setDetail(await fetchLeadDetail(lead.id))
      await reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '状态更新失败') }
  }

  function openLost(lead: LeadItem) {
    setStatusEdit(lead)
    setLostReason('')
  }

  async function saveLost() {
    if (!statusEdit) return
    if (!lostReason.trim()) { setError('标记流失需要填写流失原因'); return }
    setStatusSaving(true)
    try {
      await updateLeadStatus(statusEdit.id, 'lost', lostReason.trim())
      setStatusEdit(null)
      showToast('已标记流失')
      if (detail?.lead.id === statusEdit.id) setDetail(await fetchLeadDetail(statusEdit.id))
      await reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '状态更新失败') }
    finally { setStatusSaving(false) }
  }

  async function saveFollow() {
    if (!detail || !followDraft.trim()) return
    setFollowSaving(true)
    try {
      await addFollowUp(detail.lead.id, followDraft.trim())
      setFollowDraft(''); setDetail(await fetchLeadDetail(detail.lead.id)); await reload()
      showToast('跟进已记录')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '跟进保存失败') }
    finally { setFollowSaving(false) }
  }

  async function decideLeave(row: Record<string, unknown>, action: 'approved' | 'rejected') {
    const name = String(row.student_name || '该同学')
    if (action === 'rejected') {
      // 对齐 Vue 版业务规则:驳回必须填写原因
      setRejectReason('')
      setLeaveReject(row)
      return
    }
    const ok = await confirm({
      title: '同意该请假申请？',
      description: `${name} 的请假申请将被批准，结果会同步到员工端。`,
      confirmText: '同意',
      tone: 'danger',
    })
    if (!ok) return
    try { await approveLeave(Number(row.id), action); await reload(); showToast('已同意请假') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '审批失败') }
  }

  async function saveLeaveReject() {
    if (!leaveReject) return
    if (!rejectReason.trim()) { setError('驳回需要填写原因'); return }
    setActionSaving(true)
    try {
      await approveLeave(Number(leaveReject.id), 'rejected', rejectReason.trim())
      setLeaveReject(null)
      showToast('已驳回请假')
      await reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '审批失败') }
    finally { setActionSaving(false) }
  }

  function openProgressEdit(row: Record<string, unknown>) {
    setProgressEdit(row)
    setProgressDraft({
      stage: String(row.stage || 'under_review'),
      content: String(row.progress_detail || ''),
      nextPlan: String(row.next_action || ''),
    })
  }

  async function saveProgressEdit() {
    if (!progressEdit) return
    setActionSaving(true)
    try {
      await updateStudentProgress(Number(progressEdit.id), progressDraft.stage, progressDraft.content, progressDraft.nextPlan)
      setProgressEdit(null)
      await reload()
      showToast('申请进度已更新')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '申请进度更新失败')
    } finally {
      setActionSaving(false)
    }
  }

  function openTicketEdit(row: Record<string, unknown>, action: 'processing' | 'resolved') {
    setTicketEdit({ row, action })
    setTicketSolution(String(row.solution || ''))
  }

  async function saveTicketEdit() {
    if (!ticketEdit) return
    if (ticketEdit.action === 'resolved' && !ticketSolution.trim()) {
      setError('解决工单必须填写处理说明')
      return
    }
    setActionSaving(true)
    try {
      await handleStudentTicket(Number(ticketEdit.row.id), ticketEdit.action, ticketSolution.trim())
      setTicketEdit(null)
      await reload()
      showToast(ticketEdit.action === 'resolved' ? '工单已解决' : '工单已受理')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '工单更新失败')
    } finally {
      setActionSaving(false)
    }
  }

  async function resetMemory() {
    const ok = await confirm({ title: '清空对话记忆？', description: '只会清理当前员工的企业助手上下文，不会删除业务数据。', confirmText: '清空', tone: 'danger' })
    if (!ok) return
    try {
      await clearMemory()
      setMemory(await fetchMemory())
      setConversationId(null)
      // 照搬旧版 resetMemory:清空后回到个性化问候
      chatHydrated.current = false
      setMessages([{ role: 'assistant', text: greetFrom(brief), citation: '业务办理' }])
      showToast('对话记忆已清空')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '对话记忆清理失败')
    }
  }

  const funnel = (brief.funnel || {}) as Record<string, number>
  const statCards = useMemo(() => [
    { label: '客户总数', value: total, note: '当前筛选结果' },
    { label: '待办事项', value: Number(brief.pending_todos || 0), note: '需要今天处理' },
    { label: '待审批请假', value: Number(brief.pending_leave_approvals || 0), note: '员工端同步' },
    { label: '待处理投诉', value: Number(brief.pending_tickets || 0), note: '客户服务事项' },
  ], [brief.pending_leave_approvals, brief.pending_tickets, brief.pending_todos, total])

  return <section>
    <PageHeader
      eyebrow={<><Sparkles size={13} />Enterprise</>}
      title="对话工作台"
      desc="把客户、跟进和团队待办，收进同一个工作台。"
      actions={
        <Button variant="secondary" icon={<RefreshCw size={14} className={loading ? 'spinner' : ''} />} onClick={() => void reload()} disabled={loading}>刷新数据</Button>
      }
    />
    {error && <div className="alert"><AlertCircle size={15} /><span>{error}</span><button onClick={() => setError('')} aria-label="关闭提示"><X size={14} /></button></div>}

    <div className="grid-stats" style={{ marginBottom: 20 }}>
      {statCards.map((item, index) => <StatCard key={item.label} label={item.label} value={loading ? '—' : item.value} hint={item.note} delay={index * 50} />)}
    </div>

    <div className="workbench">
      <Panel
        flush
        className="chat"
        title="企业助手"
        desc="口述录入、客户查询和业务指令"
        actions={online ? <LiveDot>在线</LiveDot> : <Badge tone="warning">助手离线</Badge>}
      >
        <div ref={logRef} className="chat-log">
          {!messages.length && (
            <div className="chat-empty">
              <div className="chat-orb"><Sparkles size={20} /></div>
              <h3>你好，我是粤教企业助手</h3>
              <p>可以帮你录入客户、查跟进、更新状态，也能处理日报和审批。</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div className={`msg msg--${message.role}`} key={`${message.role}-${index}`}>
              <div className="msg-avatar">{message.role === 'user' ? <UserRound size={14} /> : <Spark />}</div>
              <div className="msg-main">
                <div className="msg-meta">
                  {message.role === 'user' ? '你' : '企业助手'}
                  {message.role === 'assistant' && message.intent ? <em>{message.intent}</em> : null}
                </div>
                <div className={`bubble${message.pending ? ' bubble--pending' : ''}`}>
                  {message.pending
                    ? <><LoaderCircle size={14} className="spinner" />{message.text}</>
                    : message.role === 'assistant' ? <MarkdownText text={message.text} /> : message.text}
                </div>
                {/* 照搬旧版:NL2SQL 命中的回复折叠展示 SQL */}
                {sqlOf(message) ? (
                  <details className="sql-fold">
                    <summary><Database size={11} />查看 SQL</summary>
                    <pre>{sqlOf(message)}</pre>
                  </details>
                ) : null}
                {message.citation && <div className="msg-sources"><Database size={11} />{message.citation}</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="capability-row">
          {capabilities.map((item) => (
            <button key={item.label} className="capability-chip" onClick={() => setDraft(item.hint)}>
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
        <form className="composer" onSubmit={(event) => { event.preventDefault(); void send() }}>
          <div className="composer-form">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // 输入法组合期(拼音候选)不触发发送,照搬旧版 IME 守卫
                if (event.nativeEvent.isComposing) return
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() }
              }}
              placeholder="输入一句话，让助手帮你办理…"
              rows={2}
            />
            <button className="send-btn" disabled={sending || !draft.trim()} aria-label="发送"><Send size={15} /></button>
          </div>
          <div className="composer-foot">
            <span>Enter 发送 · Shift + Enter 换行</span>
            <span><Clock3 size={12} />数据实时回读</span>
          </div>
        </form>
      </Panel>

      <Panel
        flush
        title="业务数据"
        actions={<span className="data-head-meta">{total} 条客户</span>}
        footer={
          <div className="funnel-strip">
            {Object.entries(statusLabels).map(([key, label]) => <span key={key}><b>{funnel[key] ?? 0}</b>{label}</span>)}
          </div>
        }
      >
        <Tabs
          items={[
            { key: 'leads', label: <> <UsersRound size={14} />客户</> },
            { key: 'dailies', label: <><FileText size={14} />日报</> },
            { key: 'leaves', label: <><Clock3 size={14} />请假审批{leaves.length ? '' : ''}</> },
            { key: 'progress', label: <><FileText size={14} />申请进度</> },
            { key: 'tickets', label: <><AlertCircle size={14} />学生工单</> },
            { key: 'memory', label: <><Database size={14} />对话记忆</> },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'leads' && (
          <>
            <div className="table-toolbar">
              <label className="search-box">
                <Search size={14} />
                <input placeholder="搜索客户、国家或电话" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              </label>
              <select className="select" style={{ width: 128 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">全部状态</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>客户</th><th>意向</th><th>状态</th><th>负责人</th></tr></thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} data-clickable onClick={() => void openLead(lead)}>
                      <td><strong>{lead.customer_name}</strong><small>{lead.contact_info || '未留联系方式'}</small></td>
                      <td>{[lead.intended_country, lead.intended_major].filter(Boolean).join(' · ') || '未填'}</td>
                      <td>{statusBadge(lead)}</td>
                      <td>{lead.owner_name || '—'}</td>
                    </tr>
                  ))}
                  {!leads.length && <tr><td colSpan={4}><Empty tight title="没有找到匹配客户" desc="换个关键词，或直接告诉助手新客户的信息。" /></td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === 'dailies' && (
          <div className="list-stack">
            {dailies.map((item, index) => (
              <article className="side-item" key={String(item.id || index)}>
                <div>
                  <strong>{String(item.employee_name || '员工日报')}</strong>
                  <p>{String(item.content || item.raw_content || '暂无内容')}</p>
                  {(item.key_progress || item.risks || item.next_plan) ? (
                    <div className="daily-fields">
                      {item.key_progress ? <span><em>进展</em>{joinField(item.key_progress)}</span> : null}
                      {item.risks ? <span><em>问题</em>{joinField(item.risks)}</span> : null}
                      {item.next_plan ? <span><em>计划</em>{String(item.next_plan)}</span> : null}
                    </div>
                  ) : null}
                </div>
                <time>{formatTime(item.report_date || item.create_time)}</time>
              </article>
            ))}
            {!dailies.length && <Empty tight title="暂无日报" desc="员工提交日报后会出现在这里。" />}
          </div>
        )}
        {tab === 'leaves' && (
          <div className="list-stack">
            {leaves.map((item, index) => (
              <article className="side-item" key={String(item.id || index)}>
                <div>
                  <strong>{String(item.student_name || '学生')}</strong>
                  <span>{String(item.leave_type || '请假')} · {formatTime(item.start_time)} ~ {formatTime(item.end_time)}</span>
                  <p>{String(item.reason || '未填写事由')}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  <Button size="sm" icon={<Check size={13} />} onClick={() => void decideLeave(item, 'approved')}>同意</Button>
                  <Button size="sm" variant="danger" icon={<X size={13} />} onClick={() => void decideLeave(item, 'rejected')}>驳回</Button>
                </div>
              </article>
            ))}
            {!leaves.length && <Empty tight title="暂无待审批请假" desc="有新的请假申请时会在这里等你。" />}
          </div>
        )}
        {tab === 'progress' && (
          <>
            <div className="table-toolbar">
              <Select value={progressStage} onChange={(event) => setProgressStage(event.target.value)} style={{ width: 150 }}>
                <option value="">全部阶段</option>
                <option value="submitted">已提交</option>
                <option value="document_prep">材料准备</option>
                <option value="under_review">院校审核中</option>
                <option value="offer_received">已录取</option>
                <option value="visa_processing">签证办理中</option>
              </Select>
            </div>
            <div className="table-wrap"><table className="table"><thead><tr><th>学生</th><th>目标院校</th><th>阶段</th><th>截止日期</th><th>下一步</th><th>操作</th></tr></thead><tbody>
              {studentProgress.map((row, index) => <tr key={String(row.id || index)}><td>{String(row.student_name || '—')}</td><td><strong>{String(row.target_school || '—')}</strong><br /><small>{String(row.target_major || '—')}</small></td><td><Badge tone="info">{String(row.stage || '—')}</Badge></td><td>{formatTime(row.deadline)}</td><td>{String(row.next_action || '—')}</td><td><Button size="sm" variant="ghost" onClick={() => openProgressEdit(row)}>更新</Button></td></tr>)}
              {!studentProgress.length && <tr><td colSpan={6}><Empty tight title="暂无申请进度" desc="学生提交或顾问录入申请进度后会出现在这里。" /></td></tr>}
            </tbody></table></div>
          </>
        )}
        {tab === 'tickets' && (
          <>
            <div className="table-toolbar">
              <Select value={ticketStatus} onChange={(event) => setTicketStatus(event.target.value)} style={{ width: 150 }}><option value="">全部状态</option><option value="pending">待处理</option><option value="processing">处理中</option><option value="resolved">已解决</option><option value="closed">已关闭</option></Select>
            </div>
            <div className="table-wrap"><table className="table"><thead><tr><th>学生</th><th>工单</th><th>优先级</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead><tbody>
              {studentTickets.map((row, index) => <tr key={String(row.id || index)}><td>{String(row.student_name || '—')}</td><td><strong>{String(row.title || '未命名工单')}</strong><br /><small>{String(row.content || '—')}</small></td><td><Badge tone={row.priority === 'urgent' || row.priority === 'high' ? 'danger' : 'warning'}>{String(row.priority || 'medium')}</Badge></td><td><Badge tone={row.status === 'resolved' || row.status === 'closed' ? 'success' : row.status === 'processing' ? 'info' : 'warning'}>{String(row.status_text || row.status || '—')}</Badge></td><td>{formatTime(row.create_time)}</td><td><div className="table-actions">{row.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => openTicketEdit(row, 'processing')}>受理</Button>}{row.status === 'pending' || row.status === 'processing' ? <Button size="sm" variant="primary" onClick={() => openTicketEdit(row, 'resolved')}>解决</Button> : null}</div></td></tr>)}
              {!studentTickets.length && <tr><td colSpan={6}><Empty tight title="暂无学生工单" desc="学生提交的投诉、建议和咨询会出现在这里。" /></td></tr>}
            </tbody></table></div>
          </>
        )}
        {tab === 'memory' && (
          <div className="list-stack">
            <div className="table-toolbar"><span className="side-hint">{memory?.total || 0} 条当前员工对话记忆</span><Button size="sm" variant="danger" onClick={() => void resetMemory()}>清空记忆</Button></div>
            {memory?.messages?.map((item, index) => <article className="side-item" key={`${item.create_time || 'message'}-${index}`}><div><strong>{item.role === 'user' ? '你' : '企业助手'}</strong><p>{item.content}</p></div><time>{formatTime(item.create_time)}</time></article>)}
            {!memory?.messages?.length && <Empty tight title="暂无对话记忆" desc="企业助手完成对话后，会在这里保留当前员工上下文。" />}
          </div>
        )}
      </Panel>
    </div>

    <Drawer open={detailOpen} onClose={() => setDetailOpen(false)} eyebrow="客户档案" title={detail?.lead.customer_name ?? ''}>
      {detail && (
        <>
          <div className="detail-summary">
            <div><small>当前状态</small>{statusBadge(detail.lead)}</div>
            <div><small>联系方式</small><strong>{detail.lead.contact_info || '未提供'}</strong></div>
            <div><small>意向方向</small><strong>{[detail.lead.intended_country, detail.lead.intended_major].filter(Boolean).join(' · ') || '未填写'}</strong></div>
          </div>
          {/* 照搬旧版 leads 行内操作:签约 / 流失 / 跟进中 */}
          <div className="drawer-section">
            <div className="section-title"><h2>状态流转</h2><span>{statusLabels[detail.lead.status] || detail.lead.status}</span></div>
            <div className="lead-status-actions">
              <Button size="sm" variant="ghost" disabled={detail.lead.status === 'contacting'} onClick={() => void changeStatus(detail.lead, 'contacting')}>改为跟进中</Button>
              <Button size="sm" variant="primary" disabled={detail.lead.status === 'signed'} onClick={() => void changeStatus(detail.lead, 'signed')}>标记签约</Button>
              <Button size="sm" variant="danger" disabled={detail.lead.status === 'lost'} onClick={() => openLost(detail.lead)}>标记流失</Button>
            </div>
          </div>
          <div className="drawer-section">
            <div className="section-title"><h2>跟进时间线</h2><span>{detail.follow_ups.length} 条记录</span></div>
            {detail.follow_ups.length ? (
              <div className="timeline" style={{ marginTop: 13 }}>
                {detail.follow_ups.map((item) => (
                  <div className="timeline-item" key={item.id}>
                    <i />
                    <div>
                      <p>{item.content}</p>
                      <time>{formatTime(item.create_time)}{item.next_plan ? ` · 下一步：${item.next_plan}` : ''}</time>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty tight title="还没有跟进记录" desc="写下第一笔跟进，让协作有迹可循。" />
            )}
          </div>
          <div className="drawer-section follow-editor">
            <h3>补充跟进</h3>
            <textarea className="textarea" rows={3} value={followDraft} onChange={(event) => setFollowDraft(event.target.value)} placeholder="例如：今天下午已电话沟通预算…" />
            <Button variant="primary" disabled={followSaving || !followDraft.trim()} onClick={() => void saveFollow()}>
              {followSaving ? <><LoaderCircle size={14} className="spinner" />保存中…</> : <><Plus size={14} />记一笔跟进</>}
            </Button>
          </div>
        </>
      )}
    </Drawer>

    <Modal open={Boolean(progressEdit)} onClose={() => setProgressEdit(null)} title="更新申请进度" desc={progressEdit ? `${String(progressEdit.student_name || '学生')} · ${String(progressEdit.target_school || '')}` : undefined} footer={<><Button variant="secondary" onClick={() => setProgressEdit(null)}>取消</Button><Button variant="primary" loading={actionSaving} onClick={() => void saveProgressEdit()}>保存</Button></>}>
      <div className="form-grid"><label className="field"><span className="field-label">阶段</span><Select value={progressDraft.stage} onChange={(event) => setProgressDraft({ ...progressDraft, stage: event.target.value })}><option value="submitted">已提交</option><option value="document_prep">材料准备</option><option value="under_review">院校审核中</option><option value="offer_received">已录取</option><option value="visa_processing">签证办理中</option></Select></label><label className="field"><span className="field-label">下一步</span><Input value={progressDraft.nextPlan} onChange={(event) => setProgressDraft({ ...progressDraft, nextPlan: event.target.value })} /></label><label className="field" style={{ gridColumn: '1 / -1' }}><span className="field-label">处理反馈</span><Textarea rows={5} value={progressDraft.content} onChange={(event) => setProgressDraft({ ...progressDraft, content: event.target.value })} /></label></div>
    </Modal>

    <Modal open={Boolean(ticketEdit)} onClose={() => setTicketEdit(null)} title={ticketEdit?.action === 'resolved' ? '解决学生工单' : '受理学生工单'} desc={ticketEdit ? `${String(ticketEdit.row.student_name || '学生')} · ${String(ticketEdit.row.title || '未命名工单')}` : undefined} footer={<><Button variant="secondary" onClick={() => setTicketEdit(null)}>取消</Button><Button variant="primary" loading={actionSaving} onClick={() => void saveTicketEdit()}>提交</Button></>}>
      <label className="field"><span className="field-label">处理说明{ticketEdit?.action === 'resolved' ? '（必填）' : ''}</span><Textarea rows={6} value={ticketSolution} onChange={(event) => setTicketSolution(event.target.value)} placeholder={ticketEdit?.action === 'resolved' ? '填写解决方案，学生端会看到处理结果。' : '填写受理备注，可稍后继续处理。'} /></label>
    </Modal>

    <Modal
      open={Boolean(statusEdit)}
      onClose={() => setStatusEdit(null)}
      title="标记流失"
      desc={statusEdit ? `「${statusEdit.customer_name}」将进入流失列表，可从客户看板查看。` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={() => setStatusEdit(null)}>取消</Button>
          <Button variant="primary" loading={statusSaving} onClick={() => void saveLost()}>确认流失</Button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">流失原因（必填）</span>
        <Textarea rows={3} value={lostReason} onChange={(event) => setLostReason(event.target.value)} placeholder="例如：预算不符合、已选择其他机构…" />
      </label>
    </Modal>

    <Modal
      open={Boolean(leaveReject)}
      onClose={() => setLeaveReject(null)}
      title="驳回请假申请"
      desc={leaveReject ? `「${String(leaveReject.student_name || '该同学')}」的请假申请将被驳回，驳回原因会同步给学生。` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={() => setLeaveReject(null)}>取消</Button>
          <Button variant="primary" loading={actionSaving} onClick={() => void saveLeaveReject()}>确认驳回</Button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">驳回原因（必填）</span>
        <Textarea rows={3} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="例如：请假时间段与考试冲突、材料不齐…" />
      </label>
    </Modal>
  </section>
}
