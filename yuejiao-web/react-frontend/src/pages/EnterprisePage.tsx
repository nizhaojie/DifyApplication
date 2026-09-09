import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowUpRight, Check, ChevronDown, Clock3, Database, FileText, LoaderCircle, MessageSquare, Phone, Plus, RefreshCw, Search, Send, UserRound, UsersRound, X } from 'lucide-react'
import { addFollowUp, approveLeave, chat, fetchBrief, fetchDailies, fetchLeadDetail, fetchLeads, fetchLeaves, type FollowUpItem, type LeadItem } from '@/api/enterprise'
import type { ChatResult } from '@/api/enterprise'
import { MarkdownText } from '@/components/MarkdownText'

type ChatMsg = { role: 'user' | 'assistant'; text: string; intent?: string; citation?: string; data?: Record<string, unknown>; pending?: boolean }
type Tab = 'leads' | 'dailies' | 'leaves'

const statusLabels: Record<string, string> = { new: '新线索', contacting: '跟进中', qualified: '已合格', signed: '已签约', lost: '已流失' }
const statusClass: Record<string, string> = { new: 'status-blue', contacting: 'status-amber', qualified: 'status-violet', signed: 'status-green', lost: 'status-gray' }
const capabilities = [
  { label: '录入客户', hint: '张三 13800138000 想咨询美国硕士' },
  { label: '查跟进', hint: '查一下李四最近跟进记录' },
  { label: '改状态', hint: '把李四改成已签约' },
  { label: '今日待办', hint: '我今天有什么待办？' },
]

function formatTime(value: unknown) { return value ? String(value).replace('T', ' ').slice(0, 16) : '—' }
function statusBadge(lead: LeadItem) { return <span className={`status-badge ${statusClass[lead.status] || 'status-gray'}`}><i />{lead.status_text || statusLabels[lead.status] || lead.status}</span> }

export function EnterprisePage() {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [brief, setBrief] = useState<Record<string, unknown>>({})
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [total, setTotal] = useState(0)
  const [dailies, setDailies] = useState<Record<string, unknown>[]>([])
  const [leaves, setLeaves] = useState<Record<string, unknown>[]>([])
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
  const logRef = useRef<HTMLDivElement>(null)

  async function reload() {
    setLoading(true); setError('')
    try {
      const [briefData, leadData, dailyData, leaveData] = await Promise.all([
        fetchBrief(), fetchLeads({ keyword: keyword || undefined, status: statusFilter || undefined }), fetchDailies(), fetchLeaves('pending'),
      ])
      setBrief(briefData); setLeads(leadData.items); setTotal(leadData.total); setDailies(dailyData.items); setLeaves(leaveData.items)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '数据加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { void reload() }, [keyword, statusFilter])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [messages])

  async function send(text?: string) {
    const query = (text ?? draft).trim()
    if (!query || sending) return
    if (/(同意|批准|通过|拒绝|驳回)/.test(query) && query.includes('请假') || /(已签约|已流失|改成)/.test(query) || /(想咨询|录入)/.test(query) || /1[3-9]\d{9}/.test(query)) {
      if (!window.confirm(`确认执行：${query}`)) return
    }
    setDraft(''); setSending(true)
    setMessages((items) => [...items, { role: 'user', text: query }, { role: 'assistant', text: '正在办理…', pending: true }])
    try {
      const result = await chat(query, conversationId)
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

  async function saveFollow() {
    if (!detail || !followDraft.trim()) return
    setFollowSaving(true)
    try { await addFollowUp(detail.lead.id, followDraft.trim()); setFollowDraft(''); setDetail(await fetchLeadDetail(detail.lead.id)); await reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '跟进保存失败') }
    finally { setFollowSaving(false) }
  }

  async function decideLeave(row: Record<string, unknown>, action: 'approved' | 'rejected') {
    if (!window.confirm(`${action === 'approved' ? '同意' : '驳回'} ${String(row.student_name || '该同学')} 的请假？`)) return
    try { await approveLeave(Number(row.id), action); await reload() } catch (cause) { setError(cause instanceof Error ? cause.message : '审批失败') }
  }

  const funnel = (brief.funnel || {}) as Record<string, number>
  const statCards = useMemo(() => [
    { label: '客户总数', value: total, note: '当前筛选结果' },
    { label: '待办事项', value: Number(brief.pending_todos || 0), note: '需要今天处理' },
    { label: '待审批请假', value: Number(brief.pending_leave_approvals || 0), note: '员工端同步' },
    { label: '待处理投诉', value: Number(brief.pending_tickets || 0), note: '客户服务事项' },
  ], [brief.pending_leave_approvals, brief.pending_tickets, brief.pending_todos, total])

  return <section className="enterprise-page">
    <header className="page-heading"><div><div className="eyebrow"><SparkLine /> ENTERPRISE ASSISTANT</div><h1>工作，从一句话开始</h1><p>把客户、跟进和团队待办，收进同一个工作台。</p></div><button className="ghost-button" onClick={() => void reload()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} />刷新数据</button></header>
    {error && <div className="alert-banner"><AlertCircle size={17} /><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}
    <div className="stat-grid">{statCards.map((item) => <article className="metric-card" key={item.label}><span>{item.label}</span><strong>{loading ? '—' : item.value}</strong><small>{item.note}</small></article>)}</div>
    <div className="workbench-grid">
      <section className="chat-panel panel-surface">
        <div className="panel-heading"><div className="heading-icon blue"><MessageSquare size={18} /></div><div><h2>企业助手</h2><p>支持口述录入、客户查询和业务指令</p></div><span className="live-dot">在线</span></div>
        <div className="chat-log" ref={logRef}>{!messages.length && <div className="chat-empty"><div className="assistant-orb"><SparkLine /></div><h3>你好，我是粤教企业助手</h3><p>可以帮你录入客户、查跟进、更新状态，也能处理日报和审批。</p></div>}{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === 'user' ? <UserRound size={15} /> : <SparkLine />}</div><div className="message-body"><div className="message-meta">{message.role === 'user' ? '你' : '企业助手'}<span>{message.role === 'assistant' && message.intent ? message.intent : ''}</span></div><div className={`message-bubble ${message.pending ? 'pending' : ''}`}>{message.pending ? <><LoaderCircle size={16} className="spin" />{message.text}</> : message.role === 'assistant' ? <MarkdownText text={message.text} /> : message.text}</div>{message.citation && <div className="citation"><Database size={12} />{message.citation}</div>}</div></div>)}</div>
        <div className="capability-row">{capabilities.map((item) => <button key={item.label} className="capability-chip" onClick={() => setDraft(item.hint)}><span>{item.label}</span><small>{item.hint}</small></button>)}</div>
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send() }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} placeholder="输入一句话，让助手帮你办理…" rows={2} /><button className="send-button" disabled={sending || !draft.trim()} aria-label="发送"><Send size={17} /></button></form>
        <div className="composer-foot"><span>Enter 发送 · Shift + Enter 换行</span><span><Clock3 size={13} />数据实时回读</span></div>
      </section>
      <section className="data-panel panel-surface">
        <div className="panel-heading data-heading"><div><div className="eyebrow">LIVE DATA</div><h2>业务数据</h2></div><span className="data-count">{total} 条客户</span></div>
        <div className="data-tabs"><button className={tab === 'leads' ? 'active' : ''} onClick={() => setTab('leads')}><UsersRound size={15} />客户</button><button className={tab === 'dailies' ? 'active' : ''} onClick={() => setTab('dailies')}><FileText size={15} />日报</button><button className={tab === 'leaves' ? 'active' : ''} onClick={() => setTab('leaves')}><Clock3 size={15} />请假审批</button></div>
        {tab === 'leads' && <><div className="filter-row"><label className="search-box"><Search size={15} /><input placeholder="搜索客户、国家或电话" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">全部状态</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="table-scroll"><table className="data-table"><thead><tr><th>客户</th><th>意向</th><th>状态</th><th>负责人</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} onClick={() => void openLead(lead)}><td><strong>{lead.customer_name}</strong><small>{lead.contact_info || '未留联系方式'}</small></td><td>{[lead.intended_country, lead.intended_major].filter(Boolean).join(' · ') || '未填'}</td><td>{statusBadge(lead)}</td><td>{lead.owner_name || '—'}</td></tr>)}{!leads.length && <tr><td colSpan={4}><div className="empty-cell">没有找到匹配客户</div></td></tr>}</tbody></table></div></>}
        {tab === 'dailies' && <div className="list-stack">{dailies.map((item, index) => <article className="list-item" key={String(item.id || index)}><div><strong>{String(item.employee_name || '员工日报')}</strong><p>{String(item.content || item.raw_content || '暂无内容')}</p></div><time>{formatTime(item.report_date || item.create_time)}</time></article>)}{!dailies.length && <div className="empty-cell">暂无日报</div>}</div>}
        {tab === 'leaves' && <div className="list-stack">{leaves.map((item, index) => <article className="leave-item" key={String(item.id || index)}><div className="leave-main"><strong>{String(item.student_name || '学生')}</strong><span>{String(item.leave_type || '请假')} · {formatTime(item.start_time)}</span><p>{String(item.reason || '未填写事由')}</p></div><div className="leave-actions"><button className="small-button success" onClick={() => void decideLeave(item, 'approved')}><Check size={14} />同意</button><button className="small-button danger" onClick={() => void decideLeave(item, 'rejected')}><X size={14} />驳回</button></div></article>)}{!leaves.length && <div className="empty-cell">暂无待审批请假</div>}</div>}
        <div className="funnel-strip"><div className="funnel-title"><span>客户漏斗</span><ArrowUpRight size={15} /></div><div className="funnel-items">{Object.entries(statusLabels).map(([key, label]) => <span key={key}><b>{funnel[key] ?? 0}</b>{label}</span>)}</div></div>
      </section>
    </div>
    {detailOpen && detail && <div className="drawer-backdrop" onClick={() => setDetailOpen(false)}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">CUSTOMER PROFILE</span><h2>{detail.lead.customer_name}</h2></div><button className="icon-button" onClick={() => setDetailOpen(false)}><X size={18} /></button></div><div className="detail-summary"><div><small>当前状态</small>{statusBadge(detail.lead)}</div><div><small>联系方式</small><strong><Phone size={14} />{detail.lead.contact_info || '未提供'}</strong></div><div><small>意向方向</small><strong>{[detail.lead.intended_country, detail.lead.intended_major].filter(Boolean).join(' · ') || '未填写'}</strong></div></div><div className="drawer-section"><div className="section-title"><h3>跟进时间线</h3><span>{detail.follow_ups.length} 条记录</span></div>{detail.follow_ups.length ? <div className="timeline">{detail.follow_ups.map((item) => <div className="timeline-item" key={item.id}><i /><div><p>{item.content}</p><small>{formatTime(item.create_time)}{item.next_plan ? ` · 下一步：${item.next_plan}` : ''}</small></div></div>)}</div> : <div className="empty-inline">还没有跟进记录</div>}</div><div className="drawer-section follow-editor"><h3>补充跟进</h3><textarea rows={3} value={followDraft} onChange={(event) => setFollowDraft(event.target.value)} placeholder="例如：今天下午已电话沟通预算…" /><button className="primary-button" disabled={followSaving || !followDraft.trim()} onClick={() => void saveFollow()}>{followSaving ? '保存中…' : <><Plus size={16} />记一笔跟进</>}</button></div></aside></div>}
  </section>
}

function SparkLine() { return <SparkIcon /> }
function SparkIcon() { return <span className="spark-icon"><span /><span /><span /></span> }
