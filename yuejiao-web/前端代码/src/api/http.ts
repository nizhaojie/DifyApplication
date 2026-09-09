import axios from 'axios'
import { ElMessage } from 'element-plus'

export interface Envelope<T> {
  code: number
  message: string
  data: T
  total: number | null
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8002',
  timeout: 30000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('yuejiao_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    const payload = response.data as Envelope<unknown>
    if (payload && typeof payload.code === 'number' && payload.code !== 200) {
      ElMessage.error(payload.message || '请求失败')
      if (payload.code === 401) {
        localStorage.removeItem('yuejiao_token')
        if (!location.pathname.startsWith('/login')) {
          location.href = '/login'
        }
      }
      return Promise.reject(new Error(payload.message))
    }
    return response
  },
  (error) => {
    ElMessage.error(error?.message || '网络异常')
    return Promise.reject(error)
  },
)

export default http
