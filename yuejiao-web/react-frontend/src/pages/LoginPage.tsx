import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Input } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from '@/components/feedback'
import { useAuthStore } from '@/store/authStore'

// 等价迁移自 views/login/index.vue:默认演示账号、show-password、
// 成功 toast「登录成功」、回跳 query.redirect、缺省落地 /enterprise(照搬 Vue 行为)。

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)
  const [username, setUsername] = useState('emp01')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      toast.success('登录成功')
      const redirect = searchParams.get('redirect') ?? '/enterprise'
      await navigate(redirect, { replace: true })
    } catch {
      /* interceptor already toasts */
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-card">
        <div className="brand">
          <span className="mark">粤</span>
          <div>
            <h1>粤教服务</h1>
            <p>企业智能助手 · 演示登录</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>账号</label>
            <Input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
          </div>
          <div className="form-row">
            <label>密码</label>
            <Input.Password
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
            进入控制台
          </Button>
        </form>
        <p className="hint">演示账号 emp01 / 123456（演示顾问）。后端地址：127.0.0.1:8002。</p>
      </section>
    </div>
  )
}
