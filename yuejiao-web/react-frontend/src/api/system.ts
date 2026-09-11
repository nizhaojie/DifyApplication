import http, { type Envelope } from './http'

export interface SysRole {
  id: number
  role_code: string
  role_name: string
  description: string | null
  status: number
  create_time: string
  update_time: string
  user_count?: number
}

export interface SysUserRow {
  id: number
  username: string
  real_name: string
  user_type: 'student' | 'employee' | 'admin'
  role_id: number | null
  role_code: string | null
  role_name: string | null
  department: string | null
  contact_info: string | null
  status: 'normal' | 'disabled'
  create_time: string
}

export interface UserListParams {
  keyword?: string
  user_type?: string
  status?: string
  limit?: number
  offset?: number
}

export interface CreateUserPayload {
  username: string
  password: string
  real_name: string
  role_id: number
  department?: string
  contact_info?: string
}

export interface UpdateUserPayload {
  real_name?: string
  role_id?: number
  department?: string | null
  contact_info?: string | null
  status?: 'normal' | 'disabled'
}

export interface CreateRolePayload {
  role_code: string
  role_name: string
  description?: string
}

export interface UpdateRolePayload {
  role_name?: string
  description?: string | null
  status?: number
}

export async function listUsers(params: UserListParams = {}) {
  const { data } = await http.get<Envelope<SysUserRow[]>>('/api/v1/system/users', { params })
  return { items: data.data, total: data.total ?? data.data.length }
}

export async function createUser(payload: CreateUserPayload) {
  const { data } = await http.post<Envelope<SysUserRow>>('/api/v1/system/users', payload)
  return data.data
}

export async function updateUser(id: number, payload: UpdateUserPayload) {
  const { data } = await http.put<Envelope<SysUserRow>>(`/api/v1/system/users/${id}`, payload)
  return data.data
}

export async function resetUserPassword(id: number, newPassword: string) {
  await http.put<Envelope<null>>(`/api/v1/system/users/${id}/password`, { new_password: newPassword })
}

export async function listRoles() {
  const { data } = await http.get<Envelope<SysRole[]>>('/api/v1/system/roles')
  return data.data
}

export async function createRole(payload: CreateRolePayload) {
  const { data } = await http.post<Envelope<SysRole>>('/api/v1/system/roles', payload)
  return data.data
}

export async function updateRole(id: number, payload: UpdateRolePayload) {
  const { data } = await http.put<Envelope<SysRole>>(`/api/v1/system/roles/${id}`, payload)
  return data.data
}

export async function deleteRole(id: number) {
  await http.delete<Envelope<null>>(`/api/v1/system/roles/${id}`)
}
