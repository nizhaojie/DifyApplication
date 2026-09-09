import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, FileUp, LoaderCircle, Search, UploadCloud, X } from 'lucide-react'
import { assessByFile, assessByText, fetchProfileDetail, fetchProfiles, type AssessResult, type ProfileAssessment, type ProfileRecord } from '@/api/profile'

const resultLabels: Record<string, { label: string; className: string }> = {
  matched: { label: '匹配', className: 'status-green' },
  partial: { label: '部分匹配', className: 'status-amber' },
  not_matched: { label: '不匹配', className: 'status-gray' },
}

function resultBadge(value?: string | null) {
  const meta = resultLabels[value || ''] || { label: value || '未判定', className: 'status-gray' }
  return <span className={`status-badge ${meta.className}`}><i />{meta.label}</span>
}

function score(value?: number | null) { return value == null ? '—' : `${Number(value).toFixed(1)} 分` }

function AssessmentRows({ items }: { items: ProfileAssessment[] }) {
  return <div className="assessment-list">{items.map((item) => <article className="assessment-row" key={`${item.product_line}-${item.rule_name}`}><div className="assessment-row-head"><strong>{item.product_line}</strong>{resultBadge(item.match_result)}<span>{score(item.match_score)}</span></div><small>{item.rule_name || '当前规则'}</small><div className="assessment-tags">{item.matched_labels?.map((label) => <span key={label}>{label}</span>)}{!item.matched_labels?.length && <em>无命中标签</em>}</div>{item.candidate_programs?.map((candidate, index) => <p key={`${candidate.category}-${index}`}><b>{candidate.category || '候选项目'}：</b>{candidate.programs?.join('、') || '暂无'}</p>)}</article>)}</div>
}

export function ProfilePage() {
  const [mode, setMode] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<AssessResult | null>(null)
  const [records, setRecords] = useState<ProfileRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [assessing, setAssessing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<AssessResult | null>(null)
  const pageSize = 8

  async function loadRecords() {
    setLoading(true)
    try {
      const data = await fetchProfiles({ limit: pageSize, offset: (page - 1) * pageSize, match_result: filter || undefined })
      setRecords(data.items)
      setTotal(data.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '研判记录加载失败')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadRecords() }, [page, filter])

  async function submit() {
    if (mode === 'text' && !text.trim()) { setError('请先粘贴客户信息文本'); return }
    if (mode === 'file' && !file) { setError('请选择 PDF 简历或 Excel 文件'); return }
    setAssessing(true); setError(''); setResult(null)
    try {
      setResult(mode === 'text' ? await assessByText(text.trim()) : await assessByFile(file!))
      await loadRecords()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '研判失败') }
    finally { setAssessing(false) }
  }

  async function openDetail(id: number) {
    setDetail(null); setError('')
    try { setDetail(await fetchProfileDetail(id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '研判详情加载失败') }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <section className="profile-page-react">
    <header className="page-heading"><div><div className="eyebrow"><Search size={14} /> CUSTOMER ASSESSMENT</div><h1>客户研判</h1><p>输入客户背景，判断产品线匹配度，并沉淀可回看的研判记录。</p></div></header>
    {error && <div className="alert-banner"><AlertCircle size={16} /><span>{error}</span><button onClick={() => setError('')} aria-label="关闭提示"><X size={15} /></button></div>}
    <section className="panel-surface assessment-workbench">
      <div className="panel-heading"><div className="heading-icon blue"><Search size={18} /></div><div><h2>研判工作台</h2><p>支持文本输入、PDF 简历和 Excel 客户表格</p></div></div>
      <div className="assessment-tabs"><button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>文本输入</button><button className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}><FileUp size={14} />文件上传</button></div>
      <div className="assessment-input-area">{mode === 'text' ? <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：王某，22岁，大专毕业，英语四级，家庭年收入 30-50 万，想去新加坡读专升本……" maxLength={8000} rows={7} /> : <label className="file-drop"><UploadCloud size={28} /><strong>{file ? file.name : '选择 PDF 简历或 Excel 文件'}</strong><span>支持 .pdf、.xlsx、.xls</span><input type="file" accept=".pdf,.xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>}</div>
      <div className="assessment-actions"><span>{mode === 'text' ? `${text.length} / 8000` : file ? '已选择 1 个文件' : '尚未选择文件'}</span><button className="primary-button" onClick={() => void submit()} disabled={assessing}>{assessing ? <><LoaderCircle size={15} className="spin" />研判中</> : <><Search size={15} />开始研判</>}</button></div>
      {result && <AssessmentResult result={result} />}
    </section>
    <section className="panel-surface profile-records">
      <div className="section-title"><div><div className="eyebrow">ASSESSMENT HISTORY</div><h2>研判记录</h2></div><select value={filter} onChange={(event) => { setPage(1); setFilter(event.target.value) }}><option value="">全部结果</option><option value="matched">匹配</option><option value="partial">部分匹配</option><option value="not_matched">不匹配</option></select></div>
      <div className="table-scroll"><table className="data-table profile-table"><thead><tr><th>ID</th><th>客户</th><th>结果</th><th>产品线</th><th>匹配度</th><th>研判时间</th><th>操作</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.id}</td><td><strong>{record.customer_name || '未识别姓名'}</strong></td><td>{resultBadge(record.match_result)}</td><td>{record.matched_product || '—'}</td><td>{score(record.match_score)}</td><td>{record.create_time?.replace('T', ' ').slice(0, 16) || '—'}</td><td><button className="text-button" onClick={() => void openDetail(record.id)}>查看详情</button></td></tr>)}{!records.length && <tr><td colSpan={7}><div className="empty-cell">{loading ? '正在加载研判记录…' : '还没有研判记录'}</div></td></tr>}</tbody></table></div>
      <div className="pagination"><span>共 {total} 条</span><button className="small-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button><b>{page} / {pages}</b><button className="small-button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>下一页</button></div>
    </section>
    {detail && <div className="drawer-backdrop" onClick={() => setDetail(null)}><aside className="detail-drawer profile-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">ASSESSMENT DETAIL</span><h2>{detail.customer_name || '研判详情'}</h2></div><button className="icon-button" onClick={() => setDetail(null)} aria-label="关闭"><X size={18} /></button></div><div className="detail-summary"><div><small>匹配结果</small>{resultBadge(detail.match_result)}</div><div><small>匹配产品线</small><strong>{detail.matched_product || '—'}</strong></div><div><small>匹配度</small><strong>{score(detail.match_score)}</strong></div></div>{detail.match_reason && <div className="drawer-section"><h3>研判依据</h3><p className="drawer-copy">{detail.match_reason}</p></div>}{detail.recommended_programs?.length ? <div className="drawer-section"><h3>推荐专业 / 项目</h3><div className="assessment-tags">{detail.recommended_programs.map((item) => <span key={item}>{item}</span>)}</div></div> : null}<div className="drawer-section"><h3>产品线评估</h3><AssessmentRows items={detail.assessments || []} /></div></aside></div>}
  </section>
}

function AssessmentResult({ result }: { result: AssessResult }) {
  return <div className="assessment-result"><div className="result-summary"><div><small>客户</small><strong>{result.customer_name || '未识别姓名'}</strong></div><div><small>匹配结果</small>{resultBadge(result.match_result)}</div><div><small>匹配产品线</small><strong>{result.matched_product || '—'}</strong></div><div><small>匹配度</small><strong>{score(result.match_score)}</strong></div></div>{result.match_reason && <div className="result-copy"><span>研判依据</span><p>{result.match_reason}</p></div>}{result.recommended_programs?.length ? <div className="result-copy"><span>推荐专业 / 项目</span><div className="assessment-tags">{result.recommended_programs.map((item) => <span key={item}>{item}</span>)}</div></div> : null}<div className="result-section-heading"><CheckCircle2 size={15} />产品线评估</div><AssessmentRows items={result.assessments || []} /></div>
}
