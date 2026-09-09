import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, LockKeyhole, Sparkles, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = useAuthStore((state) => state.token)
  const login = useAuthStore((state) => state.login)
  const [username, setUsername] = useState('emp01')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (token) navigate('/enterprise', { replace: true }) }, [navigate, token])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password) { setError('请输入账号和密码'); return }
    setLoading(true); setError('')
    try {
      await login(username.trim(), password)
      const from = (location.state as { from?: string } | null)?.from || '/enterprise'
      navigate(from, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请检查后端服务')
    } finally { setLoading(false) }
  }

  return <div className="login-shell">
    <div className="login-grid-glow" />
    <section className="login-brand-panel">
      <div className="brand brand-large"><div className="brand-mark"><Sparkles size={19} /></div><div><strong>粤教服务</strong><span>智能教育服务平台</span></div></div>
      <div className="login-intro"><p className="eyebrow">EDUCATION SERVICE / 01</p><h1>让每一次服务，<br /><em>都有迹可循。</em></h1><p>连接客户研判、企业协作和智能报告，把复杂的教育服务流程，变成可操作、可追踪的工作台。</p></div>
      <div className="login-footnote">LOCAL DEMO ENVIRONMENT <span>·</span> YUEJIAO SERVICE</div>
    </section>
    <section className="login-form-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="login-card-heading"><span className="eyebrow">欢迎回来</span><h2>进入工作台</h2><p>使用员工账号登录管理后台</p></div>
        <label className="field-label" htmlFor="username">账号</label>
        <div className="input-with-icon"><UserRound size={17} /><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></div>
        <label className="field-label" htmlFor="password">密码</label>
        <div className="input-with-icon"><LockKeyhole size={17} /><input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></div>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button login-submit" disabled={loading}>{loading ? '登录中…' : <>进入控制台 <ArrowRight size={17} /></>}</button>
        <p className="login-hint">演示账号：emp01 / 123456</p>
      </form>
    </section>
  </div>
}
