import { useEffect, useState } from 'react'
import { CircleAlert, Pencil, Plus, Trash2, UserCog, UsersRound, X } from 'lucide-react'
import {
  PageHeader, Panel, Button, Badge, Field, Input, Select, Textarea, Modal, Empty, Skeleton, showToast, useConfirm,
} from '@/ui'
import { createRole, deleteRole, listRoles, updateRole, type SysRole } from '@/api/system'

interface RoleFormState {
  role_code: string
  role_name: string
  description: string
  status: number
}

const EMPTY_FORM: RoleFormState = { role_code: '', role_name: '', description: '', status: 1 }

function RoleFormModal({ open, editing, onClose, onSaved }: {
  open: boolean
  editing: SysRole | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(editing
      ? { role_code: editing.role_code, role_name: editing.role_name, description: editing.description ?? '', status: editing.status }
      : EMPTY_FORM)
  }, [open, editing])

  async function save() {
    if (!editing) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(form.role_code)) { setError('角色编码需字母开头，仅限字母、数字、下划线'); return }
      if (form.role_code.length < 2) { setError('角色编码至少 2 位'); return }
    }
    if (!form.role_name.trim()) { setError('请填写角色名称'); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateRole(editing.id, {
          role_name: form.role_name.trim(),
          description: form.description.trim() || null,
          status: form.status,
        })
        showToast('角色已更新')
      } else {
        await createRole({
          role_code: form.role_code.trim(),
          role_name: form.role_name.trim(),
          description: form.description.trim() || undefined,
        })
        showToast('角色已创建，可在用户管理中分配')
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
      title={editing ? `编辑角色 · ${editing.role_name}` : '新建角色'}
      desc={editing ? '角色编码创建后不可修改' : '角色编码是系统内的唯一标识，创建后不可修改'}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>{editing ? '保存' : '创建角色'}</Button>
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
        <Field label="角色编码" hint={editing ? '创建后不可修改' : '字母开头，如：counselor'}>
          <Input
            value={form.role_code}
            maxLength={32}
            disabled={Boolean(editing)}
            placeholder="如：counselor"
            onChange={(e) => setForm((d) => ({ ...d, role_code: e.target.value }))}
          />
        </Field>
        <Field label="角色名称">
          <Input value={form.role_name} maxLength={64} placeholder="如：留学顾问" onChange={(e) => setForm((d) => ({ ...d, role_name: e.target.value }))} />
        </Field>
        <Field label="角色描述">
          <Textarea rows={3} value={form.description} maxLength={255} placeholder="一句话说明该角色的职责范围" onChange={(e) => setForm((d) => ({ ...d, description: e.target.value }))} />
        </Field>
        {editing && (
          <Field label="状态" hint="停用后挂靠该角色的账号将失去对应权限">
            <Select value={String(form.status)} onChange={(e) => setForm((d) => ({ ...d, status: Number(e.target.value) }))}>
              <option value="1">启用</option>
              <option value="0">禁用</option>
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  )
}

export function SystemRolesPage() {
  const confirm = useConfirm()
  const [roles, setRoles] = useState<SysRole[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SysRole | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRoles(await listRoles())
    } catch { /* 拦截器已 toast */ } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function remove(role: SysRole) {
    const confirmed = await confirm({
      title: `删除角色「${role.role_name}」？`,
      description: `仅当没有账号挂靠此角色时才可删除（当前 ${role.user_count ?? 0} 个账号）。`,
      confirmText: '删除',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteRole(role.id)
      showToast('角色已删除')
      await load()
    } catch { /* 拦截器已 toast（角色被占用等） */ }
  }

  const enabledCount = roles.filter((role) => role.status === 1).length

  return (
    <section>
      <PageHeader
        eyebrow={<><UserCog size={13} />System · Roles</>}
        title="角色配置"
        desc="角色字典与分配情况：新建业务角色、调整名称描述、停用不再使用的角色。"
        actions={<Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setEditing(null); setFormOpen(true) }}>新建角色</Button>}
      />

      <Panel
        flush
        title="角色列表"
        desc={`${roles.length} 个角色 · ${enabledCount} 个启用中 · 账号与角色在用户管理中分配`}
      >
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 820 }}>
            <thead>
              <tr><th>角色</th><th>编码</th><th>描述</th><th>关联账号</th><th>状态</th><th>更新时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {loading && roles.length === 0
                ? Array.from({ length: 4 }, (_, index) => (
                    <tr key={`skeleton-${index}`}>
                      {Array.from({ length: 7 }, (_, cell) => (
                        <td key={cell}><Skeleton height={11} width={cell === 0 ? '56%' : '42%'} /></td>
                      ))}
                    </tr>
                  ))
                : roles.map((role) => (
                    <tr key={role.id} className={role.status === 0 ? 'rule-disabled' : undefined}>
                      <td><strong>{role.role_name}</strong></td>
                      <td><code style={{ fontSize: 12 }}>{role.role_code}</code></td>
                      <td>{role.description || '—'}</td>
                      <td className="num">{role.user_count ?? 0}</td>
                      <td>{role.status === 1 ? <Badge tone="success" dot>启用</Badge> : <Badge tone="neutral">禁用</Badge>}</td>
                      <td><time>{role.update_time?.replace('T', ' ').slice(0, 16) || '—'}</time></td>
                      <td>
                        <span className="rule-actions-cell">
                          <button className="row-link" onClick={() => { setEditing(role); setFormOpen(true) }}><Pencil size={12} />编辑</button>
                          {(role.user_count ?? 0) === 0 && role.role_code !== 'admin' && (
                            <button className="row-link rule-link--danger" onClick={() => void remove(role)}><Trash2 size={12} />删除</button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
              {!loading && !roles.length && (
                <tr>
                  <td colSpan={7}>
                    <Empty icon={<UsersRound size={19} />} title="还没有角色" desc="新建角色后，即可在用户管理中把账号挂到对应角色。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <RoleFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
    </section>
  )
}
