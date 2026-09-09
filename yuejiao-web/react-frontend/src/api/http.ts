import axios from 'axios'

export interface Envelope<T> {
  code: number
  message: string
  data: T
  total: number | null
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || undefined,
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
        localStorage.removeItem('yuejiao_user')
        if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
      }
      return Promise.reject(new Error(payload.message || '请求失败'))
    }
    return response
  },
  (error) => Promise.reject(error),
)

export default http
