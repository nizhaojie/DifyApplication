import { create } from 'zustand'
import { fetchMe, login as loginApi, type LoginUser } from '@/api/auth'

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
  hydrate: () => Promise<void>
  logout: () => void
}

export const selectDisplayName = (state: AuthState) => state.user?.real_name || '未登录'

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: readUser(),
  async login(username, password) {
    const data = await loginApi(username, password)
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    set({ token: data.token, user: data.user })
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
