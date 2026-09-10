import axios from 'axios'
import { showToast } from '@/ui/toast'

export interface Envelope<T> {
  code: number
  message: string
  data: T
  total: number | null
}

// 与 Vue 版 api/http.ts 逐项对齐:30s 超时、Bearer 注入、
// Envelope code!==200 走 toast(只提示不解包)、401 清 token 后硬跳 /login。
// baseURL 默认走相对路径(/api 由 vite 代理或生产反代转发),避免硬编码端口造成 CORS 依赖;
// 需要直连其他后端时用 VITE_API_BASE 覆盖。
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
  timeout: 30000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('yuejiao_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => {
    const payload = response.data as Envelope<unknown>
    if (payload && typeof payload.code === 'number' && payload.code !== 200) {
      if (payload.code === 401) {
        localStorage.removeItem('yuejiao_token')
        if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
      }
      showToast(payload.message || '请求失败', 'error')
      return Promise.reject(new Error(payload.message || '请求失败'))
    }
    return response
  },
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('yuejiao_token')
      localStorage.removeItem('yuejiao_user')
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
    }
    const detail = error?.response?.data?.detail || error?.response?.data?.message
    showToast(detail || error?.message || '网络异常', 'error')
    return Promise.reject(error)
  },
)

export default http
