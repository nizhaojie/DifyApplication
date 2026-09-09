import { LogOut, MonitorCog, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  function signOut() { logout(); navigate('/login') }
  return <section className="content-page settings-page">
    <header className="page-heading"><div><div className="eyebrow"><MonitorCog size={14} /> SYSTEM SETTINGS</div><h1>设置</h1><p>查看当前账号、运行环境和演示会话状态。</p></div></header>
    <div className="settings-grid">
      <section className="panel-surface settings-card"><div className="panel-heading"><div className="heading-icon blue"><UserRound size={18} /></div><div><h2>当前账号</h2><p>来自登录会话的基本信息</p></div></div><div className="settings-body"><div className="account-profile"><div className="account-avatar">{(user?.real_name || '未').slice(0, 1)}</div><div><strong>{user?.real_name || '未登录'}</strong><span>{user?.username || '—'}</span></div></div><dl className="settings-dl"><div><dt>账号类型</dt><dd>{user?.user_type || '—'}</dd></div><div><dt>所属部门</dt><dd>{user?.department || '—'}</dd></div></dl></div></section>
      <section className="panel-surface settings-card"><div className="panel-heading"><div className="heading-icon blue"><ShieldCheck size={18} /></div><div><h2>运行环境</h2><p>答辩现场使用的本地开发环境</p></div></div><div className="settings-body"><div className="environment-row"><span>前端框架</span><strong>React + Vite</strong></div><div className="environment-row"><span>数据服务</span><strong>FastAPI / MySQL</strong></div><div className="environment-row"><span>智能服务</span><strong>Dify / 企业助手</strong></div><button className="danger-button settings-logout" onClick={signOut}><LogOut size={15} />退出当前账号</button></div></section>
    </div>
  </section>
}
