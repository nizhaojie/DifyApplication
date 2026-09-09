import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, BriefcaseBusiness, Building2, ChevronDown, ChevronLeft, ChevronRight,
  CircleUserRound, FileBarChart, Gauge, Headphones, LogOut, Menu, NotebookTabs,
  Settings, ShieldCheck, Sparkles, UserRound, UsersRound,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

type NavItem = { to: string; label: string; icon: typeof Gauge }
const mainNav: NavItem[] = [
  { to: '/dashboard', label: '工作台', icon: Gauge },
  { to: '/profile', label: '客户研判', icon: BarChart3 },
  { to: '/cs', label: '客服 Agent', icon: Headphones },
]
const enterpriseNav: NavItem[] = [
  { to: '/enterprise', label: '对话工作台', icon: Sparkles },
  { to: '/enterprise/company', label: '公司简介', icon: Building2 },
  { to: '/enterprise/guide', label: '新人指南', icon: NotebookTabs },
  { to: '/enterprise/board', label: '客户看板', icon: BarChart3 },
  { to: '/enterprise/memory', label: '对话记忆', icon: ShieldCheck },
]

function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return <NavLink to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={collapsed ? item.label : undefined}>
    <Icon size={17} strokeWidth={1.8} /><span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
  </NavLink>
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [enterpriseOpen, setEnterpriseOpen] = useState(true)
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const title = useMemo(() => {
    const map: Record<string, string> = {
      '/dashboard': '工作台', '/profile': '客户研判', '/cs': '客服 Agent', '/enterprise': '企业助手',
      '/enterprise/company': '公司简介', '/enterprise/guide': '新人指南', '/enterprise/board': '客户看板',
      '/enterprise/memory': '对话记忆', '/student': '学生助手', '/report': '智能报告', '/settings': '设置',
    }
    return map[location.pathname] || (location.pathname.startsWith('/report/') ? '报告详情' : '工作台')
  }, [location.pathname])

  return <div className={`admin-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Sparkles size={18} /></div>
        {!collapsed && <div><strong>粤教服务</strong><span>智能管理后台</span></div>}
      </div>
      <div className="nav-section-label">{collapsed ? '·' : '工作空间'}</div>
      <nav className="nav-list">
        {mainNav.map((item) => <NavEntry key={item.to} item={item} collapsed={collapsed} />)}
        <button className={`nav-link nav-group-trigger ${enterpriseOpen ? 'group-open' : ''}`} onClick={() => setEnterpriseOpen((value) => !value)} title={collapsed ? '企业助手' : undefined}>
          <BriefcaseBusiness size={17} strokeWidth={1.8} /><span className={collapsed ? 'sr-only' : ''}>企业助手</span>{!collapsed && <ChevronDown size={14} className={enterpriseOpen ? 'rotate-180' : ''} />}
        </button>
        {enterpriseOpen && !collapsed && <div className="sub-nav">{enterpriseNav.map((item) => <NavEntry key={item.to} item={item} collapsed={false} />)}</div>}
        <NavEntry item={{ to: '/student', label: '学生助手', icon: UserRound }} collapsed={collapsed} />
      </nav>
      <div className="nav-section-label bottom-label">{collapsed ? '·' : '分析与系统'}</div>
      <nav className="nav-list">
        <NavEntry item={{ to: '/report', label: '智能报告', icon: FileBarChart }} collapsed={collapsed} />
        <NavEntry item={{ to: '/settings', label: '设置', icon: Settings }} collapsed={collapsed} />
      </nav>
      <button className="collapse-button" onClick={() => setCollapsed((value) => !value)} title={collapsed ? '展开侧栏' : '收起侧栏'}>
        {collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>收起侧栏</span></>}
      </button>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setCollapsed((value) => !value)} aria-label="切换菜单"><Menu size={19} /></button><span className="breadcrumb-root">粤教服务</span><span className="breadcrumb-separator">/</span><strong>{title}</strong></div>
        <div className="topbar-right"><button className="icon-button" title="通知"><Bell size={18} /></button><span className="online-indicator"><i />本地环境</span><div className="user-menu"><div className="user-avatar">{(user?.real_name || '未').slice(0, 1)}</div><span>{user?.real_name || '未登录'}</span><button className="icon-button tiny" title="退出登录" onClick={() => { logout(); navigate('/login') }}><LogOut size={15} /></button></div></div>
      </header>
      <main className="page-content"><Outlet /></main>
    </div>
  </div>
}
