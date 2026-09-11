import http, { type Envelope } from './http'

export interface LoginUser {
  id: number
  username: string
  real_name: string
  user_type: string
  role_id?: number | null
  role_code?: string | null
  role_name?: string | null
  department: string | null
  contact_info?: string | null
  avatar_url?: string | null
  status: 'normal' | 'disabled'
}

export interface RegisterPayload {
  username: string
  password: string
  real_name: string
  contact_info?: string
}

export interface UpdateMePayload {
  real_name?: string
  department?: string | null
  contact_info?: string | null
  avatar_url?: string | null
}

export async function login(username: string, password: string) {
  const { data } = await http.post<Envelope<{ token: string; user: LoginUser }>>('/api/v1/auth/login', {
    username,
    password,
  })
  return data.data
}

/** 开放注册：默认学生角色，成功即返回会话 */
export async function register(payload: RegisterPayload) {
  const { data } = await http.post<Envelope<{ token: string; user: LoginUser }>>('/api/v1/auth/register', payload)
  return data.data
}

export async function fetchMe() {
  const { data } = await http.get<Envelope<LoginUser>>('/api/v1/auth/me')
  return data.data
}

export async function updateMe(payload: UpdateMePayload) {
  const { data } = await http.put<Envelope<LoginUser>>('/api/v1/auth/me', payload)
  return data.data
}

export async function changePassword(oldPassword: string, newPassword: string) {
  await http.put<Envelope<null>>('/api/v1/auth/password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
}
