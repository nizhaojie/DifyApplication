import http, { type Envelope } from './http'

export interface LoginUser {
  id: number
  username: string
  real_name: string
  user_type: string
  department: string | null
}

export async function login(username: string, password: string) {
  const { data } = await http.post<Envelope<{ token: string; user: LoginUser }>>('/api/v1/auth/login', {
    username,
    password,
  })
  return data.data
}

export async function fetchMe() {
  const { data } = await http.get<Envelope<LoginUser>>('/api/v1/auth/me')
  return data.data
}
