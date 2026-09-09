import { Avatar, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { selectDisplayName, useAuthStore } from '@/store/authStore'

// 超集页面(Vue 版为 EmptyModule 占位):功能保留,视觉归 Vue 体系。

export function SettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const displayName = useAuthStore(selectDisplayName)

  const signOut = () => {
    logout()
    navigate('/login')
  }

  return (
    <section className="ent-page">
      <header className="ent-head">
        <h1>设置</h1>
      </header>
      <div className="chart-row">
        <section className="chart-card">
          <h3>当前账号</h3>
          <div className="settings-account">
            <Avatar size={40}>{displayName.slice(0, 1)}</Avatar>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>{user?.real_name || '未登录'}</strong>
              <span style={{ color: '#909399', fontSize: 12 }}>{user?.username || '—'}</span>
            </div>
          </div>
          <dl className="settings-dl">
            <div>
              <dt>账号类型</dt>
              <dd>{user?.user_type || '—'}</dd>
            </div>
            <div>
              <dt>所属部门</dt>
              <dd>{user?.department || '—'}</dd>
            </div>
          </dl>
        </section>
        <section className="chart-card">
          <h3>运行环境</h3>
          <dl className="settings-dl">
            <div>
              <dt>前端框架</dt>
              <dd>React + Vite</dd>
            </div>
            <div>
              <dt>数据服务</dt>
              <dd>FastAPI / MySQL</dd>
            </div>
            <div>
              <dt>智能服务</dt>
              <dd>Dify / 企业助手</dd>
            </div>
          </dl>
          <Button danger onClick={signOut} style={{ marginTop: 12 }}>
            退出当前账号
          </Button>
        </section>
      </div>
    </section>
  )
}
