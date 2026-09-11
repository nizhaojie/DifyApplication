import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CirclePlus,
  KeyRound,
  ListChecks,
  LogOut,
  MonitorCog,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { changePassword, updateMe } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import {
  PageHeader, Panel, Button, Badge, Tabs, Field, Input, Select, Textarea,
  Drawer, Empty, Skeleton, SkeletonLines, Segmented, IconButton, showToast, useConfirm,
} from '@/ui'
import {
  fetchRules, createRule, updateRule, setRuleStatus, deleteRule,
  type ProfileRule, type ProfileRulePayload, type RuleCondition,
} from '@/api/profile'
import './settings.css'

// ==================== 设置页：研判规则（产品线）管理 + 账号环境 ====================

type TabKey = 'rules' | 'account'

const RULE_FIELD_OPTIONS = [
  { value: 'age', label: '年龄 age' },
  { value: 'gender', label: '性别 gender' },
  { value: 'education_level', label: '学历 education_level' },
  { value: 'location', label: '所在地 location' },
  { value: 'income_level', label: '收入水平 income_level' },
  { value: 'income_rank', label: '收入档次(1-4) income_rank' },
  { value: 'de_qualified', label: '德语B1+ de_qualified' },
  { value: 'needs', label: '需求标签 needs' },
  { value: 'intended_country', label: '意向国家 intended_country' },
  { value: 'hands_on', label: '动手能力强 hands_on' },
  { value: 'logic_strong', label: '逻辑思维强 logic_strong' },
  { value: 'learning_attitude', label: '学习毅力 learning_attitude' },
  { value: 'background_keywords', label: '背景关键词 background_keywords' },
  { value: 'core_demand', label: '核心诉求 core_demand' },
]

const OP_OPTIONS = [
  { value: 'between', label: '区间 between' },
  { value: 'gte', label: '不小于 gte' },
  { value: 'lte', label: '不超过 lte' },
  { value: 'in', label: '属于 in' },
  { value: 'not_in', label: '不属于 not_in' },
  { value: 'contains_any', label: '含任一 contains_any' },
  { value: 'not_contains_any', label: '不含任一 not_contains_any' },
  { value: 'truthy', label: '有值即真 truthy' },
  { value: 'eq', label: '等于 eq' },
]

const AGE_KEY_OPTIONS = [
  { value: 'age_min', label: '年龄下限 age_min' },
  { value: 'age_max', label: '年龄上限 age_max' },
]

const LIST_OPS = ['in', 'not_in', 'contains_any', 'not_contains_any']

function splitList(raw: string): string[] {
  return raw.split(/[,，、;；]/).map((item) => item.trim()).filter(Boolean)
}

function asNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed || Number.isNaN(Number(trimmed))) return null
  return Number(trimmed)
}

// ---------- 编辑器草稿模型：把 rule_content 的 JSON 拍平成可编辑文本 ----------

interface CondDraft {
  field: string
  op: string
  value: string
  value2: string
  weight: string
  label: string
}

interface MatchPairDraft {
  field: string
  values: string
}

interface PmapDraft {
  match: MatchPairDraft[]
  programs: string
  category: string
  rationale: string
}

interface EditorForm {
  product_line: string
  rule_name: string
  priority: string
  status: 0 | 1
  match_prompt: string
  matched: string
  partial: string
  conditions: CondDraft[]
  program_map: PmapDraft[]
}

function emptyForm(): EditorForm {
  return {
    product_line: '', rule_name: '', priority: '0', status: 1, match_prompt: '',
    matched: '60', partial: '40',
    conditions: [{ field: 'age', op: 'between', value: '', value2: '', weight: '10', label: '' }],
    program_map: [],
  }
}

function condValueToDraft(cond: RuleCondition): string {
  if (cond.op === 'between') return Array.isArray(cond.value) ? String(cond.value[0] ?? '') : ''
  if (Array.isArray(cond.value)) return cond.value.join(', ')
  return cond.value == null ? '' : String(cond.value)
}

function toDraft(rule: ProfileRule): EditorForm {
  const content = rule.rule_content || {}
  return {
    product_line: rule.product_line,
    rule_name: rule.rule_name,
    priority: String(rule.priority ?? 0),
    status: rule.status === 1 ? 1 : 0,
    match_prompt: rule.match_prompt || '',
    matched: String(content.thresholds?.matched ?? 60),
    partial: String(content.thresholds?.partial ?? 40),
    conditions: (content.conditions || []).map((cond) => ({
      field: cond.field,
      op: cond.op,
      value: condValueToDraft(cond),
      value2: cond.op === 'between' && Array.isArray(cond.value) ? String(cond.value[1] ?? '') : '',
      weight: String(cond.weight ?? 0),
      label: cond.label || '',
    })),
    program_map: (content.program_map || []).map((entry) => ({
      match: Object.entries(entry.match || {}).map(([field, value]) => ({
        field,
        values: Array.isArray(value) ? value.join(', ') : String(value ?? ''),
      })),
      programs: (entry.programs || []).join(', '),
      category: entry.category || '',
      rationale: entry.rationale || '',
    })),
  }
}

function buildCondValue(cond: CondDraft): unknown | undefined {
  if (cond.op === 'truthy') return undefined
  if (cond.op === 'between') return [asNumber(cond.value), asNumber(cond.value2)]
  if (cond.op === 'gte' || cond.op === 'lte') return asNumber(cond.value)
  if (LIST_OPS.includes(cond.op)) return splitList(cond.value)
  // eq：数字串转数字，避免与画像里的 int 字段比较失配
  const numeric = asNumber(cond.value)
  return numeric != null ? numeric : cond.value.trim()
}

function validateForm(form: EditorForm): string {
  if (!form.product_line.trim()) return '请填写产品线名称'
  if (!form.rule_name.trim()) return '请填写规则名称'
  for (const [index, cond] of form.conditions.entries()) {
    const tag = `第 ${index + 1} 条评分条件`
    if (cond.op === 'between') {
      const lo = asNumber(cond.value)
      const hi = asNumber(cond.value2)
      if (lo == null || hi == null) return `${tag}：区间取值需为数字`
      if (lo > hi) return `${tag}：区间下限不能大于上限`
    }
    if ((cond.op === 'gte' || cond.op === 'lte') && asNumber(cond.value) == null) return `${tag}：取值需为数字`
    if (LIST_OPS.includes(cond.op) && !splitList(cond.value).length) return `${tag}：请至少填一个取值`
  }
  const matched = asNumber(form.matched)
  const partial = asNumber(form.partial)
  if (matched == null || partial == null) return '判定阈值需为数字'
  if (matched < 0 || matched > 100 || partial < 0 || partial > 100) return '判定阈值需在 0-100 之间'
  if (partial > matched) return '部分匹配阈值不能高于匹配阈值'
  return ''
}

function toPayload(form: EditorForm): ProfileRulePayload {
  return {
    product_line: form.product_line.trim(),
    rule_name: form.rule_name.trim(),
    match_prompt: form.match_prompt.trim() || null,
    priority: asNumber(form.priority) ?? 0,
    status: form.status,
    rule_content: {
      conditions: form.conditions.map((cond) => ({
        field: cond.field,
        op: cond.op,
        ...(cond.op === 'truthy' ? {} : { value: buildCondValue(cond) }),
        weight: asNumber(cond.weight) ?? 0,
        ...(cond.label.trim() ? { label: cond.label.trim() } : {}),
      })),
      thresholds: {
        matched: asNumber(form.matched) ?? 60,
        partial: asNumber(form.partial) ?? 40,
      },
      program_map: form.program_map.map((entry) => ({
        match: Object.fromEntries(entry.match.map((pair) => [
          pair.field,
          pair.field === 'age_min' || pair.field === 'age_max' ? asNumber(pair.values) ?? 0 : splitList(pair.values),
        ])),
        programs: splitList(entry.programs),
        ...(entry.category.trim() ? { category: entry.category.trim() } : {}),
        ...(entry.rationale.trim() ? { rationale: entry.rationale.trim() } : {}),
      })),
    },
  }
}

// ---------- 规则编辑抽屉 ----------

function RuleEditorDrawer({ open, rule, onClose, onSaved }: {
  open: boolean
  rule: ProfileRule | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<EditorForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(rule ? toDraft(rule) : emptyForm())
      setError('')
    }
  }, [open, rule])

  function patch(mutate: (draft: EditorForm) => EditorForm) {
    setForm((prev) => mutate({ ...prev }))
  }

  function patchCond(index: number, next: Partial<CondDraft>) {
    patch((draft) => {
      draft.conditions = draft.conditions.map((cond, i) => (i === index ? { ...cond, ...next } : cond))
      return draft
    })
  }

  function patchEntry(entryIndex: number, next: Partial<PmapDraft>) {
    patch((draft) => {
      draft.program_map = draft.program_map.map((entry, i) => (i === entryIndex ? { ...entry, ...next } : entry))
      return draft
    })
  }

  async function save() {
    const message = validateForm(form)
    if (message) { setError(message); return }
    setError('')
    setSaving(true)
    try {
      if (rule) await updateRule(rule.id, toPayload(form))
      else await createRule(toPayload(form))
      showToast(rule ? '规则已更新，下次研判即时生效' : '规则已创建，下次研判即时生效')
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={rule ? '编辑研判规则' : '新增研判规则'}
      title={rule?.product_line || '新增产品线规则'}
      width={760}
      footer={
        <div className="rule-editor-foot">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>保存规则</Button>
        </div>
      }
    >
      {error && (
        <div className="alert" style={{ marginBottom: 14 }}>
          <TriangleAlert size={15} /><span>{error}</span>
          <button onClick={() => setError('')} aria-label="关闭提示"><X size={14} /></button>
        </div>
      )}

      <div className="drawer-section" style={{ marginTop: 0 }}>
        <h3>产品线与规则</h3>
        <div className="rule-form-grid">
          <Field label="产品线名称"><Input value={form.product_line} maxLength={64} placeholder="如：中德精英人才共建计划" onChange={(e) => patch((d) => ({ ...d, product_line: e.target.value }))} /></Field>
          <Field label="规则名称"><Input value={form.rule_name} maxLength={128} placeholder="如：中德精英人才共建计划 · 研判规则" onChange={(e) => patch((d) => ({ ...d, rule_name: e.target.value }))} /></Field>
          <Field label="优先级" hint="数值越大越优先"><Input type="number" value={form.priority} onChange={(e) => patch((d) => ({ ...d, priority: e.target.value }))} /></Field>
          <Field label="状态">
            <Segmented
              items={[{ key: '1', label: '启用' }, { key: '0', label: '禁用' }]}
              value={String(form.status)}
              onChange={(key) => patch((d) => ({ ...d, status: key === '1' ? 1 : 0 }))}
            />
          </Field>
        </div>
      </div>

      <div className="drawer-section">
        <h3>AI 研判提示词</h3>
        <Textarea
          rows={4}
          value={form.match_prompt}
          placeholder="留给 narrate 工作流的产品线研判口径，如：年龄18-35、高中及以上学历、德语B1或强学习意愿……未命中规则不得宣称匹配。"
          onChange={(e) => patch((d) => ({ ...d, match_prompt: e.target.value }))}
        />
      </div>

      <div className="drawer-section">
        <h3>评分条件 <em>命中条件的权重之和 ÷ 总权重 = 匹配度</em></h3>
        {form.conditions.length > 0 && (
          <>
            <div className="rule-cond-grid rule-cond-head">
              <span>画像字段</span><span>算子</span><span>取值</span><span>权重</span><span>命中标签</span><span />
            </div>
            {form.conditions.map((cond, index) => (
              <div className="rule-cond-grid rule-cond-row" key={index}>
                <Select value={cond.field} onChange={(e) => patchCond(index, { field: e.target.value })}>
                  {RULE_FIELD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
                <Select value={cond.op} onChange={(e) => patchCond(index, { op: e.target.value, value: '', value2: '' })}>
                  {OP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
                {cond.op === 'truthy' ? (
                  <span className="rule-cond-hint">字段有值即命中</span>
                ) : cond.op === 'between' ? (
                  <span className="rule-between">
                    <Input type="number" value={cond.value} placeholder="下限" aria-label="区间下限" onChange={(e) => patchCond(index, { value: e.target.value })} />
                    <em>–</em>
                    <Input type="number" value={cond.value2} placeholder="上限" aria-label="区间上限" onChange={(e) => patchCond(index, { value2: e.target.value })} />
                  </span>
                ) : (
                  <Input
                    type={cond.op === 'gte' || cond.op === 'lte' ? 'number' : 'text'}
                    value={cond.value}
                    placeholder={LIST_OPS.includes(cond.op) ? '多个值用逗号分隔' : cond.op === 'eq' ? '精确匹配值' : '数字'}
                    onChange={(e) => patchCond(index, { value: e.target.value })}
                  />
                )}
                <Input type="number" value={cond.weight} aria-label="权重" onChange={(e) => patchCond(index, { weight: e.target.value })} />
                <Input value={cond.label} placeholder="命中后展示的标签" onChange={(e) => patchCond(index, { label: e.target.value })} />
                <IconButton label="删除条件" size="sm" onClick={() => patch((d) => ({ ...d, conditions: d.conditions.filter((_, i) => i !== index) }))}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </>
        )}
        <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => patch((d) => ({ ...d, conditions: [...d.conditions, { field: 'age', op: 'between', value: '', value2: '', weight: '10', label: '' }] }))}>
          添加条件
        </Button>
      </div>

      <div className="drawer-section">
        <h3>判定阈值</h3>
        <div className="rule-form-grid">
          <Field label="匹配阈值 matched" hint="≥ 此分数判定为匹配"><Input type="number" min={0} max={100} value={form.matched} onChange={(e) => patch((d) => ({ ...d, matched: e.target.value }))} /></Field>
          <Field label="部分匹配阈值 partial" hint="≥ 此分数判定为部分匹配"><Input type="number" min={0} max={100} value={form.partial} onChange={(e) => patch((d) => ({ ...d, partial: e.target.value }))} /></Field>
        </div>
      </div>

      <div className="drawer-section">
        <h3>细分专业映射 <em>命中匹配条件时，把专业组加入推荐候选</em></h3>
        {form.program_map.map((entry, entryIndex) => (
          <div className="rule-pmap-card" key={entryIndex}>
            <div className="rule-pmap-head">
              <strong>映射组 {entryIndex + 1}</strong>
              <IconButton label="删除映射组" size="sm" onClick={() => patch((d) => ({ ...d, program_map: d.program_map.filter((_, i) => i !== entryIndex) }))}>
                <Trash2 size={14} />
              </IconButton>
            </div>
            {entry.match.map((pair, pairIndex) => (
              <div className="rule-pmap-match" key={pairIndex}>
                <Select
                  value={pair.field}
                  onChange={(e) => patchEntry(entryIndex, { match: entry.match.map((p, i) => (i === pairIndex ? { ...p, field: e.target.value } : p)) })}
                >
                  {[...AGE_KEY_OPTIONS, ...RULE_FIELD_OPTIONS].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
                <Input
                  value={pair.values}
                  placeholder={pair.field === 'age_min' || pair.field === 'age_max' ? '数字，如 17' : '多个值用逗号分隔，如：机电, 机械, 数控'}
                  onChange={(e) => patchEntry(entryIndex, { match: entry.match.map((p, i) => (i === pairIndex ? { ...p, values: e.target.value } : p)) })}
                />
                <IconButton
                  label="删除匹配项" size="sm"
                  onClick={() => patchEntry(entryIndex, { match: entry.match.filter((_, i) => i !== pairIndex) })}
                >
                  <X size={14} />
                </IconButton>
              </div>
            ))}
            <Button
              variant="ghost" size="sm" icon={<Plus size={14} />}
              onClick={() => patchEntry(entryIndex, { match: [...entry.match, { field: 'background_keywords', values: '' }] })}
            >
              添加匹配项
            </Button>
            <div className="rule-form-grid rule-pmap-grid">
              <Field label="推荐专业（逗号分隔）"><Input value={entry.programs} placeholder="如：机电一体化技术, 工业机械师" onChange={(e) => patchEntry(entryIndex, { programs: e.target.value })} /></Field>
              <Field label="分组名称"><Input value={entry.category} placeholder="如：高端制造与精密技术" onChange={(e) => patchEntry(entryIndex, { category: e.target.value })} /></Field>
              <Field label="推荐理由"><Input value={entry.rationale} placeholder="展示给研判人的一句话依据" onChange={(e) => patchEntry(entryIndex, { rationale: e.target.value })} /></Field>
            </div>
          </div>
        ))}
        <Button
          variant="ghost" size="sm" icon={<CirclePlus size={14} />}
          onClick={() => patch((d) => ({ ...d, program_map: [...d.program_map, { match: [{ field: 'background_keywords', values: '' }], programs: '', category: '', rationale: '' }] }))}
        >
          添加映射组
        </Button>
      </div>
    </Drawer>
  )
}

// ---------- 规则列表面板 ----------

function RulesPanel() {
  const confirm = useConfirm()
  const [rules, setRules] = useState<ProfileRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ProfileRule | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRules(await fetchRules())
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '研判规则加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function openCreate() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(rule: ProfileRule) {
    setEditing(rule)
    setEditorOpen(true)
  }

  async function toggle(rule: ProfileRule) {
    const next: 0 | 1 = rule.status === 1 ? 0 : 1
    try {
      await setRuleStatus(rule.id, next)
      showToast(next === 1 ? '已启用，下次研判生效' : '已禁用，下次研判不再参与')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '状态切换失败')
    }
  }

  async function remove(rule: ProfileRule) {
    const confirmed = await confirm({
      title: '删除研判规则？',
      description: `「${rule.product_line}」的规则将被移除，历史研判记录保留不受影响。`,
      confirmText: '删除',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteRule(rule.id)
      showToast('规则已删除')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败')
    }
  }

  const enabledCount = rules.filter((rule) => rule.status === 1).length

  return (
    <section className="stack">
      {error && (
        <div className="alert"><AlertCircle size={15} /><span>{error}</span><button onClick={() => setError('')} aria-label="关闭提示"><X size={14} /></button></div>
      )}
      <Panel
        flush
        title="研判规则（产品线）"
        desc={`${rules.length} 条产品线规则 · ${enabledCount} 条启用中 · 改动对下一次研判即时生效`}
        actions={<Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>新增产品线规则</Button>}
      >
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 860 }}>
            <thead>
              <tr><th>产品线</th><th>规则名称</th><th>规则配置</th><th>优先级</th><th>状态</th><th>更新时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {loading && rules.length === 0
                ? Array.from({ length: 3 }, (_, index) => (
                    <tr key={`skeleton-${index}`}>
                      {Array.from({ length: 7 }, (_, cell) => (
                        <td key={cell}><Skeleton height={11} width={cell === 1 ? '70%' : '48%'} /></td>
                      ))}
                    </tr>
                  ))
                : rules.map((rule) => {
                    const content = rule.rule_content || {}
                    return (
                      <tr key={rule.id} className={rule.status === 0 ? 'rule-disabled' : undefined}>
                        <td><strong>{rule.product_line}</strong></td>
                        <td>{rule.rule_name}</td>
                        <td>
                          <span className="rule-config-cell">
                            {(content.conditions || []).length} 条条件
                            · 阈值 {content.thresholds?.matched ?? 60}/{content.thresholds?.partial ?? 40}
                            · {(content.program_map || []).length} 组映射
                          </span>
                        </td>
                        <td className="num">{rule.priority}</td>
                        <td>{rule.status === 1 ? <Badge tone="success" dot>启用</Badge> : <Badge tone="neutral">禁用</Badge>}</td>
                        <td><time>{rule.update_time?.replace('T', ' ').slice(0, 16) || '—'}</time></td>
                        <td className="rule-actions-cell">
                          <button className="row-link" onClick={() => openEdit(rule)}><Pencil size={12} />编辑</button>
                          <button className="row-link" onClick={() => void toggle(rule)}>{rule.status === 1 ? '禁用' : '启用'}</button>
                          <button className="row-link rule-link--danger" onClick={() => void remove(rule)}><Trash2 size={12} />删除</button>
                        </td>
                      </tr>
                    )
                  })}
              {!loading && !rules.length && (
                <tr>
                  <td colSpan={7}>
                    <Empty icon={<ListChecks size={19} />} title="还没有研判规则" desc="新增一条产品线规则后，客户研判工作台即可按产品线打分。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && rules.length > 0 && <SkeletonLines rows={2} />}
      </Panel>
      <RuleEditorDrawer
        open={editorOpen}
        rule={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void load()}
      />
    </section>
  )
}

// ---------- 账号与安全（资料维护 + 密码修改 + 退出登录） ----------

function AccountPanel() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()

  // —— 资料编辑 ——
  const [realName, setRealName] = useState(user?.real_name ?? '')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [contact, setContact] = useState(user?.contact_info ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  // —— 密码修改 ——
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  async function submitProfile(event: FormEvent) {
    event.preventDefault()
    if (!realName.trim()) { showToast('姓名不能为空', 'error'); return }
    setSavingProfile(true)
    try {
      const next = await updateMe({
        real_name: realName.trim(),
        department: department.trim() || null,
        contact_info: contact.trim() || null,
      })
      setUser(next)
      showToast('资料已更新')
    } catch { /* 拦截器已 toast */ } finally { setSavingProfile(false) }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault()
    if (newPwd.length < 6) { showToast('新密码至少 6 位', 'error'); return }
    if (newPwd !== confirmPwd) { showToast('两次输入的新密码不一致', 'error'); return }
    setSavingPwd(true)
    try {
      await changePassword(oldPwd, newPwd)
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      showToast('密码已修改，下次登录请使用新密码')
    } catch { /* 拦截器已 toast */ } finally { setSavingPwd(false) }
  }

  function signOut() {
    logout()
    showToast('已退出登录')
    navigate('/login')
  }

  const roleLabel = user?.role_name || user?.role_code || user?.user_type || '—'

  return (
    <section className="stack">
      <div className="grid-2">
        <Panel title="当前账号" desc="来自登录会话的基本信息，可直接维护">
          <div style={{ padding: '4px 0 6px' }}>
            <div className="account-profile">
              <span className="avatar avatar--lg">{(user?.real_name || '未').slice(0, 1)}</span>
              <div>
                <strong style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{user?.real_name || '未登录'}</strong>
                <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: 'var(--text-4)' }}>{user?.username || '—'}</span>
              </div>
              <span style={{ marginLeft: 'auto' }}>
                <Badge tone={user?.status === 'disabled' ? 'danger' : 'success'} dot>
                  {user?.status === 'disabled' ? '已停用' : '正常'}
                </Badge>
              </span>
            </div>
            <form onSubmit={submitProfile}>
              <div className="form-grid" style={{ marginTop: 14 }}>
                <Field label="姓名">
                  <Input value={realName} onChange={(event) => setRealName(event.target.value)} placeholder="真实姓名" maxLength={64} />
                </Field>
                <Field label="所属部门 / 院系">
                  <Input value={department ?? ''} onChange={(event) => setDepartment(event.target.value)} placeholder="如：客服部" maxLength={128} />
                </Field>
                <Field label="联系方式" hint="手机号或邮箱">
                  <Input value={contact ?? ''} onChange={(event) => setContact(event.target.value)} placeholder="手机号或邮箱" maxLength={128} />
                </Field>
                <Field label="账号类型" hint="角色由管理员分配，如需调整请联系系统管理员">
                  <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
                    <Badge tone="brand"><UserRound size={12} style={{ marginRight: 5 }} />{roleLabel}</Badge>
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-4)' }}>{user?.user_type || '—'}</span>
                  </div>
                </Field>
              </div>
              <Button type="submit" variant="primary" loading={savingProfile} style={{ marginTop: 16 }}>保存资料</Button>
            </form>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <Button variant="danger" icon={<LogOut size={14} />} onClick={signOut}>退出当前账号</Button>
            </div>
          </div>
        </Panel>
        <Panel title="登录密码" desc="修改后下次登录生效，当前会话不受影响">
          <form onSubmit={submitPassword}>
            <div className="form-grid">
              <Field label="原密码">
                <Input type="password" value={oldPwd} onChange={(event) => setOldPwd(event.target.value)} autoComplete="current-password" placeholder="请输入原密码" />
              </Field>
              <Field label="新密码" hint="至少 6 位">
                <Input type="password" value={newPwd} onChange={(event) => setNewPwd(event.target.value)} autoComplete="new-password" placeholder="至少 6 位" />
              </Field>
              <Field label="确认新密码">
                <Input type="password" value={confirmPwd} onChange={(event) => setConfirmPwd(event.target.value)} autoComplete="new-password" placeholder="再输入一次新密码" />
              </Field>
            </div>
            <Button type="submit" variant="primary" loading={savingPwd} icon={<KeyRound size={14} />} style={{ marginTop: 16 }}>修改密码</Button>
          </form>
        </Panel>
      </div>
      <p style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-4)' }}>
        <ShieldCheck size={13} />会话与鉴权信息仅保存在本机浏览器
      </p>
    </section>
  )
}

export function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('rules')
  return (
    <section>
      <PageHeader
        eyebrow={<><MonitorCog size={13} />Settings</>}
        title="设置"
        desc="管理客户研判的产品线规则，以及账号资料与密码。"
        actions={
          <Tabs
            className="tabs--plain"
            items={[
              { key: 'rules', label: <><ListChecks size={14} />研判规则</> },
              { key: 'account', label: '账号设置' },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />
      {tab === 'rules' ? <RulesPanel /> : <AccountPanel />}
    </section>
  )
}
