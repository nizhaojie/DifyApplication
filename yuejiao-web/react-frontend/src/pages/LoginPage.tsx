import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, LockKeyhole, Sparkles, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Field, Input, Button } from '@/ui'
import { BlurText } from '@/ui/fx/BlurText'

// 学生角色登录后落 /student,员工落 /enterprise(对齐 Vue 版 views/login/index.vue 的 defaultPath 行为)
function landingPathFor(user: { user_type?: string } | null | undefined, from?: string) {
  return from || (user?.user_type === 'student' ? '/student' : '/enterprise')
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const [username, setUsername] = useState('emp01')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) navigate(landingPathFor(user), { replace: true })
  }, [navigate, token, user])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password) { setError('请输入账号和密码'); return }
    setLoading(true); setError('')
    try {
      await login(username.trim(), password)
      const loggedIn = useAuthStore.getState().user
      navigate(landingPathFor(loggedIn, (location.state as { from?: string } | null)?.from), { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请检查后端服务')
    } finally { setLoading(false) }
  }

  return <div className="login-shell">
    <section className="login-brand">
      <div className="sidebar-brand" style={{ padding: 0 }}>
        <span className="brand-mark"><Sparkles size={16} strokeWidth={2.1} /></span>
        <div className="brand-text">
          <strong>粤教服务</strong>
          <span>智能教育服务平台</span>
        </div>
      </div>
      <div className="login-intro">
        <p className="page-header-eyebrow">Education Service</p>
        <h1>
          <BlurText text="让每一次服务，" />
          <br />
          <BlurText text="都有迹可循。" delay={0.3} />
        </h1>
        <p>连接客户研判、企业协作和智能报告，把复杂的教育服务流程，变成可操作、可追踪的工作台。</p>
      </div>
      <div className="login-footnote">LOCAL DEMO ENVIRONMENT<span>·</span>YUEJIAO SERVICE</div>
    </section>

    <section className="login-form-side">
      <form className="login-card" onSubmit={submit}>
        <p className="page-header-eyebrow">欢迎回来</p>
        <h2>进入工作台</h2>
        <p>使用员工账号登录管理后台</p>
        <Field label="账号">
          <div className="input-wrap"><UserRound size={16} /><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></div>
        </Field>
        <Field label="密码">
          <div className="input-wrap"><LockKeyhole size={16} /><input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></div>
        </Field>
        {error && <div className="alert login-error" style={{ marginBottom: 0 }}><span>{error}</span></div>}
        <Button type="submit" variant="primary" size="lg" className="login-submit" block loading={loading}>
          {loading ? '登录中…' : <>进入工作台 <ArrowRight size={16} /></>}
        </Button>
        <p className="login-hint">演示账号 <kbd>emp01</kbd> · 密码 <kbd>123456</kbd></p>
      </form>
    </section>
  </div>
}
