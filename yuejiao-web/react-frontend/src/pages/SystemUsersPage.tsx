import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, KeyRound, Pencil, Plus, Search, ShieldX, UsersRound, X } from 'lucide-react'
import {
  PageHeader, Panel, Button, Badge, Field, Input, Select, Modal, Empty, Skeleton, showToast, useConfirm,
} from '@/ui'
import { useAuthStore } from '@/store/authStore'
import {
  createUser, listRoles, listUsers, resetUserPassword, updateUser,
  type SysRole, type SysUserRow,
} from '@/api/system'

const PAGE_SIZE = 10

const USER_TYPE_LABEL: Record<string, string> = {
  student: '学生',
  employee: '员工',
  admin: '管理员',
}

function roleBadgeTone(roleCode: string | null): 'brand' | 'info' | 'violet' | 'neutral' {
  if (roleCode === 'admin') return 'brand'
  if (roleCode === 'manager' || roleCode === 'team_leader') return 'info'
  if (roleCode === 'student') return 'violet'
  return 'neutral'
}

// ---------- 新建 / 编辑账号弹窗 ----------

interface UserFormState {
  username: string
  password: string
  real_name: string
  role_id: string
  department: string
  contact_info: string
  status: 'normal' | 'disabled'
}

const EMPTY_FORM: UserFormState = {
  username: '', password: '', real_name: '', role_id: '',
  department: '', contact_info: '', status: 'normal',
}

function UserFormModal({ open, roles, editing, onClose, onSaved }: {
  open: boolean
  roles: SysRole[]
  editing: SysUserRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(editing
      ? {
          username: editing.username,
          password: '',
          real_name: editing.real_name,
          role_id: editing.role_id ? String(editing.role_id) : '',
          department: editing.department ?? '',
          contact_info: editing.contact_info ?? '',
          status: editing.status,
        }
      : EMPTY_FORM)
  }, [open, editing])

  async function save() {
    const roleId = Number(form.role_id)
    if (!editing) {
      if (form.username.trim().length < 3) { setError('账号至少 3 位'); return }
      if (form.password.length < 6) { setError('初始密码至少 6 位'); return }
    }
    if (!form.real_name.trim()) { setError('请填写姓名'); return }
    if (!roleId) { setError('请选择角色'); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateUser(editing.id, {
          real_name: form.real_name.trim(),
          role_id: roleId !== editing.role_id ? roleId : undefined,
          department: form.department.trim() || null,
          contact_info: form.contact_info.trim() || null,
          status: form.status !== editing.status ? form.status : undefined,
        })
        showToast('账号已更新')
      } else {
        await createUser({
          username: form.username.trim(),
          password: form.password,
          real_name: form.real_name.trim(),
          role_id: roleId,
          department: form.department.trim() || undefined,
          contact_info: form.contact_info.trim() || undefined,
        })
        showToast('账号已创建，角色类型随角色自动推导')
      }
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `编辑账号 · ${editing.username}` : '新建账号'}
      desc={editing ? '改派角色后，账号类型随角色自动调整' : '员工 / 管理员账号由管理员创建；学生可自行注册'}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>{editing ? '保存' : '创建账号'}</Button>
        </>
      }
    >
      {error && (
        <div className="alert" style={{ marginBottom: 14 }}>
          <CircleAlert size={15} /><span>{error}</span>
          <button onClick={() => setError('')} aria-label="关闭提示"><X size={14} /></button>
        </div>
      )}
      <div className="form-grid">
        {!editing && (
          <Field label="登录账号" hint="3 位以上，仅限字母、数字、_.-">
            <Input value={form.username} maxLength={32} placeholder="如：emp02" onChange={(e) => setForm((d) => ({ ...d, username: e.target.value }))} />
          </Field>
        )}
        <Field label="姓名">
          <Input value={form.real_name} maxLength={64} placeholder="真实姓名" onChange={(e) => setForm((d) => ({ ...d, real_name: e.target.value }))} />
        </Field>
        {!editing && (
          <Field label="初始密码" hint="至少 6 位，请通知本人登录后修改">
            <Input type="password" value={form.password} maxLength={64} placeholder="初始密码" onChange={(e) => setForm((d) => ({ ...d, password: e.target.value }))} />
          </Field>
        )}
        <Field label="角色" hint="决定工作台可见范围与权限">
          <Select value={form.role_id} onChange={(e) => setForm((d) => ({ ...d, role_id: e.target.value }))}>
            <option value="">请选择角色</option>
            {roles.filter((role) => role.status === 1).map((role) => (
              <option key={role.id} value={role.id}>{role.role_name}（{role.role_code}）</option>
            ))}
          </Select>
        </Field>
        <Field label="所属部门 / 院系">
          <Input value={form.department} maxLength={128} placeholder="如：客服部" onChange={(e) => setForm((d) => ({ ...d, department: e.target.value }))} />
        </Field>
        <Field label="联系方式">
          <Input value={form.contact_info} maxLength={128} placeholder="手机号或邮箱" onChange={(e) => setForm((d) => ({ ...d, contact_info: e.target.value }))} />
        </Field>
        {editing && (
          <Field label="账号状态">
            <Select value={form.status} onChange={(e) => setForm((d) => ({ ...d, status: e.target.value as 'normal' | 'disabled' }))}>
              <option value="normal">正常</option>
              <option value="disabled">停用</option>
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  )
}

// ---------- 重置密码弹窗 ----------

function ResetPasswordModal({ open, target, onClose }: {
  open: boolean
  target: SysUserRow | null
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setPassword('') }, [open])

  async function save() {
    if (!target || password.length < 6) { showToast('新密码至少 6 位', 'error'); return }
    setSaving(true)
    try {
      await resetUserPassword(target.id, password)
      showToast(`已重置 ${target.username} 的密码`)
      onClose()
    } catch { /* 拦截器已 toast */ } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`重置密码 · ${target?.username ?? ''}`}
      desc="重置后请通知本人使用新密码登录"
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>确认重置</Button>
        </>
      }
    >
      <Field label="新密码" hint="至少 6 位">
        <Input type="password" value={password} maxLength={64} placeholder="新密码" onChange={(e) => setPassword(e.target.value)} />
      </Field>
    </Modal>
  )
}

// ---------- 用户管理页 ----------

export function SystemUsersPage() {
  const confirm = useConfirm()
  const currentUser = useAuthStore((state) => state.user)
  const [rows, setRows] = useState<SysUserRow[]>([])
  const [roles, setRoles] = useState<SysRole[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [userType, setUserType] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SysUserRow | null>(null)
  const [resetting, setResetting] = useState<SysUserRow | null>(null)

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const query = useMemo(() => ({ keyword, userType, status }), [keyword, userType, status])

  async function load(nextPage = page) {
    setLoading(true)
    try {
      const result = await listUsers({
        keyword: query.keyword.trim() || undefined,
        user_type: query.userType || undefined,
        status: query.status || undefined,
        limit: PAGE_SIZE,
        offset: (nextPage - 1) * PAGE_SIZE,
      })
      setRows(result.items)
      setTotal(result.total)
    } catch { /* 拦截器已 toast */ } finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(page) }, [page])
  useEffect(() => {
    void listRoles().then(setRoles).catch(() => undefined)
  }, [])

  function search() {
    setPage(1)
    void load(1)
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(row: SysUserRow) {
    setEditing(row)
    setFormOpen(true)
  }

  async function toggleStatus(row: SysUserRow) {
    const next = row.status === 'normal' ? 'disabled' : 'normal'
    const confirmed = await confirm({
      title: next === 'disabled' ? `停用账号 ${row.username}？` : `恢复账号 ${row.username}？`,
      description: next === 'disabled' ? '停用后该账号将无法登录工作台。' : '恢复后该账号可重新登录。',
      confirmText: next === 'disabled' ? '停用' : '恢复',
      tone: next === 'disabled' ? 'danger' : 'default',
    })
    if (!confirmed) return
    try {
      await updateUser(row.id, { status: next })
      showToast(next === 'disabled' ? '账号已停用' : '账号已恢复')
      await load()
    } catch { /* 拦截器已 toast */ }
  }

  return (
    <section>
      <PageHeader
        eyebrow={<><UsersRound size={13} />System · Users</>}
        title="用户管理"
        desc="全部登录账号统一管理：创建员工账号、分配角色、停用与重置密码。"
        actions={<Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>新建账号</Button>}
      />

      <Panel
        flush
        title="账号列表"
        desc={`共 ${total} 个账号 · 停用账号无法登录但保留历史数据`}
        actions={
          <div className="table-toolbar" style={{ border: 'none', padding: 0, background: 'transparent' }}>
            <Input
              style={{ width: 170 }}
              value={keyword}
              placeholder="搜索账号 / 姓名"
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') search() }}
            />
            <Select style={{ width: 108 }} value={userType} onChange={(event) => { setUserType(event.target.value); setPage(1) }}>
              <option value="">全部类型</option>
              <option value="admin">管理员</option>
              <option value="employee">员工</option>
              <option value="student">学生</option>
            </Select>
            <Select style={{ width: 96 }} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
              <option value="">全部状态</option>
              <option value="normal">正常</option>
              <option value="disabled">停用</option>
            </Select>
            <Button size="sm" variant="secondary" icon={<Search size={14} />} onClick={search}>查询</Button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 880 }}>
            <thead>
              <tr><th>账号</th><th>角色</th><th>类型</th><th>部门 / 院系</th><th>联系方式</th><th>状态</th><th>创建时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {loading && rows.length === 0
                ? Array.from({ length: 5 }, (_, index) => (
                    <tr key={`skeleton-${index}`}>
                      {Array.from({ length: 8 }, (_, cell) => (
                        <td key={cell}><Skeleton height={11} width={cell === 0 ? '62%' : '44%'} /></td>
                      ))}
                    </tr>
                  ))
                : rows.map((row) => {
                    const isSelf = currentUser?.id === row.id
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.username}</strong>
                          {isSelf && <span style={{ marginLeft: 6 }}><Badge tone="brand">我</Badge></span>}
                          <br />
                          <small>{row.real_name}</small>
                        </td>
                        <td>{row.role_code ? <Badge tone={roleBadgeTone(row.role_code)}>{row.role_name || row.role_code}</Badge> : <span>—</span>}</td>
                        <td>{USER_TYPE_LABEL[row.user_type] || row.user_type}</td>
                        <td>{row.department || '—'}</td>
                        <td>{row.contact_info || '—'}</td>
                        <td>{row.status === 'normal' ? <Badge tone="success" dot>正常</Badge> : <Badge tone="danger" dot>停用</Badge>}</td>
                        <td><time>{row.create_time?.replace('T', ' ').slice(0, 16) || '—'}</time></td>
                        <td>
                          <span className="rule-actions-cell">
                            <button className="row-link" onClick={() => openEdit(row)}><Pencil size={12} />编辑</button>
                            <button className="row-link" onClick={() => setResetting(row)}><KeyRound size={12} />重置密码</button>
                            {!isSelf && (
                              <button className="row-link rule-link--danger" onClick={() => void toggleStatus(row)}>
                                <ShieldX size={12} />{row.status === 'normal' ? '停用' : '恢复'}
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={8}>
                    <Empty icon={<UsersRound size={19} />} title="没有匹配的账号" desc="调整筛选条件，或新建一个账号。" />
                  </td>
                </tr>
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

      <UserFormModal
        open={formOpen}
        roles={roles}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
      <ResetPasswordModal
        open={resetting != null}
        target={resetting}
        onClose={() => setResetting(null)}
      />
    </section>
  )
}
