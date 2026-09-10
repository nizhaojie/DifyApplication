import { useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import { AlertCircle, CheckCircle2, FileUp, LoaderCircle, Search, UploadCloud, X } from 'lucide-react'
import { assessByFile, assessByText, fetchProfileDetail, fetchProfiles, type AssessResult, type ProfileAssessment, type ProfileRecord } from '@/api/profile'
import { PageHeader, Panel, Button, Badge, Tabs, Select, Textarea, Drawer, Empty, Skeleton, SkeletonLines, showToast } from '@/ui'
import './profile.css'

// 旧版每页 10 条
const pageSize = 10

const resultLabels: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  matched: { label: '匹配', tone: 'success' },
  partial: { label: '部分匹配', tone: 'warning' },
  not_matched: { label: '不匹配', tone: 'neutral' },
}

function resultBadge(value?: string | null) {
  const meta = resultLabels[value || '']
  if (!meta) return <Badge tone="neutral">{value || '未判定'}</Badge>
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>
}

function score(value?: number | null) { return value == null ? '—' : `${Number(value).toFixed(1)} 分` }

/** 匹配度进度条(等价旧版 antd Progress:matched→绿、not_matched→红、partial→蓝) */
function ScoreBar({ value, result }: { value?: number | null; result?: string | null }) {
  const percent = Math.min(100, Math.max(0, Math.round(Number(value ?? 0))))
  const color = result === 'matched' ? 'var(--success)' : result === 'not_matched' ? 'var(--danger)' : 'var(--info)'
  return (
    <div className="profile-scorebar" role="img" aria-label={`匹配度 ${percent}%`}>
      <span className="profile-scorebar-track">
        <span className="profile-scorebar-fill" style={{ width: `${percent}%`, background: color }} />
      </span>
      <em>{percent}%</em>
    </div>
  )
}

function AssessmentRows({ items }: { items: ProfileAssessment[] }) {
  return (
    <div className="assess-list">
      {items.map((item) => (
        <article className="assess-row" key={`${item.product_line}-${item.rule_name}`}>
          <div className="assess-row-head">
            <strong>{item.product_line}</strong>
            {resultBadge(item.match_result)}
            <span>{score(item.match_score)}</span>
          </div>
          <small>{item.rule_name || '当前规则'}</small>
          <div className="tag-row">
            {item.matched_labels?.map((label) => <span className="tag" key={label}>{label}</span>)}
            {!item.matched_labels?.length && <em>无命中标签</em>}
          </div>
          {item.candidate_programs?.map((candidate, index) => (
            <p key={`${candidate.category}-${index}`}><b>{candidate.category || '候选项目'}：</b>{candidate.programs?.join('、') || '暂无'}</p>
          ))}
        </article>
      ))}
    </div>
  )
}

export function ProfilePage() {
  const [mode, setMode] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<AssessResult | null>(null)
  const [records, setRecords] = useState<ProfileRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [assessing, setAssessing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<AssessResult | null>(null)
  // 旧版行为:点击「查看详情」立即开抽屉,加载中展示 Spin;这里等价为 Skeleton
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  // 旧版 55% 宽抽屉,在常规桌面宽度下约 760px
  const detailWidth = Math.min(760, Math.round(window.innerWidth * 0.55))

  async function loadRecords() {
    setLoading(true)
    try {
      const data = await fetchProfiles({ limit: pageSize, offset: (page - 1) * pageSize, match_result: filter || undefined })
      setRecords(data.items)
      // 旧版回退:total 缺失时用当前页条数(api 层把 null 归一成 0)
      setTotal(data.total || data.items.length)
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
      showToast('研判完成')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '研判失败') }
    finally { setAssessing(false) }
  }

  function onDropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragOver(false)
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  async function openDetail(id: number) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    setError('')
    try { setDetail(await fetchProfileDetail(id)) }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : '研判详情加载失败')
      setDetailOpen(false)
    } finally { setDetailLoading(false) }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return <section>
    <PageHeader
      eyebrow={<><Search size={13} />Assessment</>}
      title="客户研判"
      desc="输入客户背景，判断产品线匹配度，并沉淀可回看的研判记录。"
    />
    {error && <div className="alert"><AlertCircle size={15} /><span>{error}</span><button onClick={() => setError('')} aria-label="关闭提示"><X size={14} /></button></div>}

    <section className="stack">
      <Panel
        flush
        title="研判工作台"
        desc="支持文本输入、PDF 简历和 Excel 客户表格"
        actions={
          <Tabs
            className="tabs--plain"
            items={[
              { key: 'text', label: '文本输入' },
              { key: 'file', label: <><FileUp size={14} />文件上传</> },
            ]}
            value={mode}
            onChange={setMode}
          />
        }
      >
        <div className="assess-input">
          {mode === 'text' ? (
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="例如：王某，22岁，大专毕业，英语四级，家庭年收入 30-50 万，想去新加坡读专升本……"
              maxLength={8000}
              rows={7}
            />
          ) : (
            <label
              className={`file-drop${dragOver ? ' profile-dragover' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDropFile}
            >
              <UploadCloud size={26} />
              <strong>{file ? file.name : '拖拽 PDF 简历 / Excel 到此处，或点击选择'}</strong>
              <span>支持 .pdf、.xlsx、.xls</span>
              <input type="file" accept=".pdf,.xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
          )}
        </div>
        <div className="assess-actions">
          <span className="assess-count">
            {mode === 'text' ? `${text.length} / 8000` : file ? '已选择 1 个文件' : '尚未选择文件'}
          </span>
          <Button variant="primary" onClick={() => void submit()} disabled={assessing}>
            {assessing ? <><LoaderCircle size={14} className="spinner" />研判中</> : <><Search size={14} />开始研判</>}
          </Button>
        </div>
        {result && (
          <div className="assess-result">
            <div className="result-summary">
              <div><small>客户</small><strong>{result.customer_name || '未识别姓名'}</strong></div>
              <div><small>匹配结果</small>{resultBadge(result.match_result)}</div>
              <div><small>匹配产品线</small><strong>{result.matched_product || '—'}</strong></div>
              <div><small>匹配度</small><ScoreBar value={result.match_score} result={result.match_result} /></div>
            </div>
            {result.match_reason && <div className="result-block"><span>研判依据</span><p>{result.match_reason}</p></div>}
            {result.recommended_programs?.length ? (
              <div className="result-block">
                <span>推荐专业 / 项目</span>
                <div className="tag-row">{result.recommended_programs.map((item) => <span className="tag" key={item}>{item}</span>)}</div>
              </div>
            ) : null}
            <div className="result-heading"><CheckCircle2 size={14} />产品线评估</div>
            <AssessmentRows items={result.assessments || []} />
          </div>
        )}
      </Panel>

      <Panel flush title="研判记录" actions={
        <Select style={{ width: 132 }} value={filter} onChange={(event) => { setPage(1); setFilter(event.target.value) }}>
          <option value="">全部结果</option>
          <option value="matched">匹配</option>
          <option value="partial">部分匹配</option>
          <option value="not_matched">不匹配</option>
        </Select>
      }>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 760 }}>
            <thead>
              <tr><th>ID</th><th>客户</th><th>结果</th><th>产品线</th><th>匹配度</th><th>研判时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {loading && records.length === 0
                ? Array.from({ length: 4 }, (_, index) => (
                    <tr key={`skeleton-${index}`}>
                      {Array.from({ length: 7 }, (_, cell) => (
                        <td key={cell}><Skeleton height={11} width={cell === 1 ? '70%' : '46%'} /></td>
                      ))}
                    </tr>
                  ))
                : records.map((record) => (
                    <tr key={record.id}>
                      <td className="num">{record.id}</td>
                      <td><strong>{record.customer_name || '未识别姓名'}</strong></td>
                      <td>{resultBadge(record.match_result)}</td>
                      <td>{record.matched_product || '—'}</td>
                      <td className="num">{score(record.match_score)}</td>
                      <td><time>{record.create_time?.replace('T', ' ').slice(0, 16) || '—'}</time></td>
                      <td><button className="row-link" onClick={() => void openDetail(record.id)}>查看详情</button></td>
                    </tr>
                  ))}
              {!loading && !records.length && (
                <tr><td colSpan={7}><Empty icon={<Search size={19} />} title="还没有研判记录" desc="在上方工作台提交第一份客户背景，记录会沉淀在这里。" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>共 {total} 条</span>
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</Button>
          <span>{page} / {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>下一页</Button>
        </div>
      </Panel>
    </section>

    <Drawer open={detailOpen} onClose={() => setDetailOpen(false)} eyebrow="研判详情" title={detail?.customer_name || '研判详情'} width={detailWidth}>
      {detailLoading && !detail && (
        <div className="drawer-section"><SkeletonLines rows={6} /></div>
      )}
      {detail && (
        <>
          <div className="detail-summary">
            <div><small>匹配结果</small>{resultBadge(detail.match_result)}</div>
            <div><small>匹配产品线</small><strong>{detail.matched_product || '—'}</strong></div>
            <div><small>匹配度</small><strong>{score(detail.match_score)}</strong></div>
          </div>
          {detail.match_reason && <div className="drawer-section"><h3>研判依据</h3><p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-2)' }}>{detail.match_reason}</p></div>}
          {detail.recommended_programs?.length ? (
            <div className="drawer-section">
              <h3>推荐专业 / 项目</h3>
              <div className="tag-row" style={{ marginTop: 0 }}>{detail.recommended_programs.map((item) => <span className="tag" key={item}>{item}</span>)}</div>
            </div>
          ) : null}
          <div className="drawer-section"><h3>产品线评估</h3><AssessmentRows items={detail.assessments || []} /></div>
        </>
      )}
    </Drawer>
  </section>
}
