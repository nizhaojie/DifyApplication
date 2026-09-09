import axios from 'axios'
import { toast } from '@/components/feedback'

export interface Envelope<T> {
  code: number
  message: string
  data: T
  total: number | null
}

// 与 Vue 版 api/http.ts 逐项对齐:baseURL 兜底 8002、30s 超时、Bearer 注入、
// Envelope code!==200 走 toast(只提示不解包)、401 清 token 后硬跳 /login。
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8002',
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
      toast.error(payload.message || '请求失败')
      return Promise.reject(new Error(payload.message || '请求失败'))
    }
    return response
  },
  (error) => {
    toast.error(error?.message || '网络异常')
    return Promise.reject(error)
  },
)

export default http
