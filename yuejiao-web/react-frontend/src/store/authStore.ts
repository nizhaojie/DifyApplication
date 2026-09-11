import { create } from 'zustand'
import {
  fetchMe, login as loginApi, register as registerApi,
  type LoginUser, type RegisterPayload,
} from '@/api/auth'

const TOKEN_KEY = 'yuejiao_token'
const USER_KEY = 'yuejiao_user'

function readUser(): LoginUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LoginUser
  } catch {
    return null
  }
}

interface AuthState {
  token: string
  user: LoginUser | null
  login: (username: string, password: string) => Promise<void>
  /** 注册即登录：落 token 与用户 */
  register: (payload: RegisterPayload) => Promise<void>
  /** 资料编辑后同步本地会话（/auth/me 的返回） */
  setUser: (user: LoginUser) => void
  hydrate: () => Promise<void>
  logout: () => void
}

export const selectDisplayName = (state: AuthState) => state.user?.real_name || '未登录'

function persist(token: string, user: LoginUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return { token, user }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: readUser(),
  async login(username, password) {
    const data = await loginApi(username, password)
    set(persist(data.token, data.user))
  },
  async register(payload) {
    const data = await registerApi(payload)
    set(persist(data.token, data.user))
  },
  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user })
  },
  async hydrate() {
    if (!get().token) return
    try {
      const user = await fetchMe()
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      set({ user })
    } catch {
      get().logout()
    }
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ token: '', user: null })
  },
}))
