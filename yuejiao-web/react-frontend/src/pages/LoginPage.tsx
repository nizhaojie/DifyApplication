import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, LockKeyhole, Phone, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Field, Button, showToast } from '@/ui'
import { BlurText } from '@/ui/fx/BlurText'

const REMEMBER_KEY = 'yuejiao_remember_account'

type LoginMode = 'login' | 'register'

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
  const register = useAuthStore((state) => state.register)
  const [mode, setMode] = useState<LoginMode>('login')
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? 'emp01')
  const [password, setPassword] = useState('123456')
  const [confirm, setConfirm] = useState('')
  const [realName, setRealName] = useState('')
  const [contact, setContact] = useState('')
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) != null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) navigate(landingPathFor(user), { replace: true })
  }, [navigate, token, user])

  function switchMode(next: LoginMode) {
    setMode(next)
    setError('')
    if (next === 'register') {
      setUsername('')
      setPassword('')
    } else {
      setUsername(localStorage.getItem(REMEMBER_KEY) ?? '')
      setPassword('')
    }
    setConfirm('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'register') {
      const name = username.trim()
      if (name.length < 3) { setError('账号至少 3 位，仅限字母、数字、_.-'); return }
      if (!realName.trim()) { setError('请填写姓名'); return }
      if (password.length < 6) { setError('密码至少 6 位'); return }
      if (password !== confirm) { setError('两次输入的密码不一致'); return }
      setLoading(true); setError('')
      try {
        await register({ username: name, password, real_name: realName.trim(), contact_info: contact.trim() || undefined })
        const created = useAuthStore.getState().user
        showToast('注册成功，已自动登录')
        navigate(landingPathFor(created, (location.state as { from?: string } | null)?.from), { replace: true })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '注册失败，请检查后端服务')
      } finally { setLoading(false) }
      return
    }
    if (!username.trim() || !password) { setError('请输入账号和密码'); return }
    setLoading(true); setError('')
    try {
      await login(username.trim(), password)
      if (remember) localStorage.setItem(REMEMBER_KEY, username.trim())
      else localStorage.removeItem(REMEMBER_KEY)
      const loggedIn = useAuthStore.getState().user
      navigate(landingPathFor(loggedIn, (location.state as { from?: string } | null)?.from), { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请检查后端服务')
    } finally { setLoading(false) }
  }

  const isRegister = mode === 'register'

  return <div className="login-stage">
    <div className="login-decor" aria-hidden="true">
      <span className="decor-ring decor-ring-lg" />
      <span className="decor-ring decor-ring-sm" />
      <span className="decor-arch" />
      <span className="decor-sphere decor-sphere-a" />
      <span className="decor-sphere decor-sphere-b" />
      <svg className="decor-flow" viewBox="0 0 1440 320" fill="none" preserveAspectRatio="none">
        <path d="M-40 250 C 320 140, 620 330, 900 220 S 1380 120, 1500 190" stroke="url(#flowGrad)" strokeWidth="1.2" />
        <defs>
          <linearGradient id="flowGrad" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c9a86a" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c9a86a" stopOpacity="0.4" />
            <stop offset="1" stopColor="#c9a86a" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <header className="login-topbar">
      <div className="login-brandlock">
        <span className="brand-mark"><Sparkles size={16} strokeWidth={2.1} /></span>
        <div className="brand-text">
          <strong>粤教服务</strong>
          <span>智能教育服务平台</span>
        </div>
      </div>
      <span className="login-env"><i />本地演示环境</span>
    </header>

    <main className="login-main">
      <section className="login-hero">
        <p className="login-eyebrow">YUEJIAO · INTELLIGENT SERVICE</p>
        <h1 className="login-display">
          <BlurText text="让每一次服务，" />
          <BlurText text="都有迹可循。" delay={0.35} />
        </h1>
        <p className="login-sub">
          客户研判 · 客服 Agent · 企业助手 · 学生助手 · 智能报告
          <br />
          五项能力，汇聚成同一个可信的工作台。
        </p>
      </section>

      <form className="login-card" onSubmit={submit}>
        <div className="login-mode" role="tablist" aria-label="登录或注册">
          <button type="button" role="tab" aria-selected={!isRegister} className={isRegister ? '' : 'active'} onClick={() => switchMode('login')}>登录</button>
          <button type="button" role="tab" aria-selected={isRegister} className={isRegister ? 'active' : ''} onClick={() => switchMode('register')}>注册</button>
        </div>
        <h2>{isRegister ? '创建学生账号' : '登录'}</h2>
        <p className="login-card-sub">
          {isRegister ? '注册即开通学生助手，员工账号请联系管理员开通' : '欢迎回来，请使用工作台账号继续'}
        </p>
        <Field label="账号">
          <div className="input-wrap"><UserRound size={16} /><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder={isRegister ? '字母开头，3 位以上' : '员工账号或学生账号'} /></div>
        </Field>
        {isRegister && (
          <Field label="姓名">
            <div className="input-wrap"><Sparkles size={16} /><input id="real_name" value={realName} onChange={(event) => setRealName(event.target.value)} autoComplete="name" placeholder="请输入真实姓名" /></div>
          </Field>
        )}
        <Field label="密码">
          <div className="input-wrap"><LockKeyhole size={16} /><input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? '至少 6 位' : '请输入密码'} /></div>
        </Field>
        {isRegister && (
          <>
            <Field label="确认密码">
              <div className="input-wrap"><LockKeyhole size={16} /><input id="confirm_password" value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" autoComplete="new-password" placeholder="再输入一次密码" /></div>
            </Field>
            <Field label="联系方式（选填）">
              <div className="input-wrap"><Phone size={16} /><input id="contact_info" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="手机号或邮箱" /></div>
            </Field>
          </>
        )}
        {!isRegister && (
          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>记住账号</span>
          </label>
        )}
        {error && <div className="alert login-error" style={{ marginBottom: 0 }}><span>{error}</span></div>}
        <Button type="submit" variant="primary" size="lg" className="login-submit" block loading={loading}>
          {loading ? (isRegister ? '注册中…' : '登录中…') : <>{isRegister ? <>注册并进入 <ArrowRight size={16} /></> : <>进入工作台 <ArrowRight size={16} /></>}</>}
        </Button>
        <p className="login-security">
          <ShieldCheck size={13} />
          {isRegister ? '注册即表示同意演示环境使用条款，账号数据仅存于本机。' : '安全提示：请确认访问的是本机演示环境，不要在公共设备上保存密码。'}
        </p>
      </form>
    </main>

    <footer className="login-foot">
      <span>LOCAL DEMO ENVIRONMENT · YUEJIAO SERVICE</span>
      <span>© 2026 粤教服务 · 智能工作台</span>
    </footer>
  </div>
}
