import { LogOut, MonitorCog, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { PageHeader, Panel, Button, showToast } from '@/ui'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  function signOut() {
    logout()
    showToast('已退出登录')
    navigate('/login')
  }
  return <section>
    <PageHeader
      eyebrow={<><MonitorCog size={13} />Settings</>}
      title="设置"
      desc="查看当前账号、运行环境和演示会话状态。"
    />
    <div className="grid-2">
      <Panel flush title="当前账号" desc="来自登录会话的基本信息">
        <div style={{ padding: '18px 20px 20px' }}>
          <div className="account-profile">
            <span className="avatar avatar--lg">{(user?.real_name || '未').slice(0, 1)}</span>
            <div>
              <strong style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{user?.real_name || '未登录'}</strong>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: 'var(--text-4)' }}>{user?.username || '—'}</span>
            </div>
          </div>
          <dl className="settings-dl">
            <div><dt>账号类型</dt><dd>{user?.user_type || '—'}</dd></div>
            <div><dt>所属部门</dt><dd>{user?.department || '—'}</dd></div>
          </dl>
        </div>
      </Panel>
      <Panel flush title="运行环境" desc="答辩现场使用的本地开发环境">
        <div style={{ padding: '18px 20px 20px' }}>
          <div className="env-row"><span>前端框架</span><strong>React + Vite</strong></div>
          <div className="env-row"><span>数据服务</span><strong>FastAPI / MySQL</strong></div>
          <div className="env-row"><span>智能服务</span><strong>Dify / 企业助手</strong></div>
          <Button variant="danger" style={{ marginTop: 16 }} icon={<LogOut size={14} />} onClick={signOut}>退出当前账号</Button>
        </div>
      </Panel>
    </div>
    <p style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-4)' }}>
      <ShieldCheck size={13} />会话与鉴权信息仅保存在本机浏览器
    </p>
  </section>
}
