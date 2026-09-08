import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchMe, login as loginApi, type LoginUser } from '@/api/auth'

const TOKEN_KEY = 'yuejiao_token'
const USER_KEY = 'yuejiao_user'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref<LoginUser | null>(readUser())

  const displayName = computed(() => user.value?.real_name || '未登录')
  const loggedIn = computed(() => Boolean(token.value))

  function readUser(): LoginUser | null {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as LoginUser
    } catch {
      return null
    }
  }

  async function login(username: string, password: string) {
    const data = await loginApi(username, password)
    token.value = data.token
    user.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  }

  async function hydrate() {
    if (!token.value) return
    try {
      user.value = await fetchMe()
      localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, displayName, loggedIn, login, hydrate, logout }
})
