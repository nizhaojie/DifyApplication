import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  BarChart3, Bell, BriefcaseBusiness, Building2, ChevronDown,
  FileBarChart, Gauge, Headphones, LogOut, Menu, NotebookTabs,
  PanelLeftClose, PanelLeftOpen, Search,
  Settings, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { CommandPalette, type CommandEntry } from '@/ui/CommandPalette'
import { ConfirmProvider } from '@/ui/ConfirmProvider'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  keywords?: string
}

const workspaceNav: NavItem[] = [
  { to: '/dashboard', label: '工作台', icon: Gauge, keywords: 'dashboard home' },
  { to: '/profile', label: '客户研判', icon: BarChart3, keywords: 'assessment profile' },
  { to: '/cs', label: '客服 Agent', icon: Headphones, keywords: 'customer service' },
]

const enterpriseNav: NavItem[] = [
  { to: '/enterprise', label: '对话工作台', icon: Sparkles, keywords: 'chat assistant' },
  { to: '/enterprise/company', label: '公司简介', icon: Building2, keywords: 'company' },
  { to: '/enterprise/guide', label: '新人指南', icon: NotebookTabs, keywords: 'guide onboarding' },
  { to: '/enterprise/board', label: '客户看板', icon: BarChart3, keywords: 'board funnel' },
  { to: '/enterprise/memory', label: '对话记忆', icon: ShieldCheck, keywords: 'memory' },
]

const systemNav: NavItem[] = [
  { to: '/student', label: '学生助手', icon: UserRound, keywords: 'student' },
  { to: '/report', label: '智能报告', icon: FileBarChart, keywords: 'report' },
  { to: '/settings', label: '设置', icon: Settings, keywords: 'settings' },
]

const pageTitleMap: Record<string, string> = {
  '/student/psych': '心理关怀助手',
  '/student/life': '海外生活支持',
  '/student/program': '学业提升咨询',
  '/report/customer-ops': '全域客户经营分析',
  '/report/daily-summary': '员工日报智能汇总',
  '/report/psych-weekly': '学生心理健康周报',
  '/report/complaint-weekly': '投诉处理周报',
}

function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/enterprise'}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      data-tip={collapsed ? item.label : undefined}
    >
      <Icon size={16.5} strokeWidth={1.9} />
      <span>{item.label}</span>
    </NavLink>
  )
}

function NavLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  return collapsed ? <span className="nav-label sr-only">{children}</span> : <div className="nav-label">{children}</div>
}

export function AdminLayout() {
  // 仅在中等宽度桌面自动折叠；移动端抽屉始终以展开态渲染
  const [collapsed, setCollapsed] = useState(() => window.innerWidth > 960 && window.innerWidth <= 1280)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [enterpriseOpen, setEnterpriseOpen] = useState(() => window.location.pathname.startsWith('/enterprise'))
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const isStudent = user?.user_type === 'student' || user?.role_code === 'student'
  const visibleWorkspaceNav = isStudent ? [] : workspaceNav
  const visibleEnterpriseNav = isStudent ? [] : enterpriseNav
  const visibleSystemNav = isStudent ? systemNav.filter((item) => item.to === '/student') : systemNav

  // route change closes the mobile drawer
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // ⌘K / Ctrl+K opens the command palette
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const title = useMemo(
    () =>
      pageTitleMap[location.pathname] ??
      [...visibleWorkspaceNav, ...visibleEnterpriseNav, ...visibleSystemNav].find((item) => item.to === location.pathname)?.label ??
      '工作台',
    [location.pathname, visibleEnterpriseNav, visibleSystemNav, visibleWorkspaceNav],
  )

  const commandEntries = useMemo<CommandEntry[]>(() => {
    const toEntries = (group: string, items: NavItem[]) =>
      items.map((item) => ({
        id: item.to,
        label: item.label,
        group,
        icon: item.icon,
        keywords: item.keywords,
        run: () => navigate(item.to),
      }))
    return [
      ...toEntries('工作空间', visibleWorkspaceNav),
      ...toEntries('企业助手', visibleEnterpriseNav),
      ...toEntries('分析与系统', visibleSystemNav),
    ]
  }, [navigate, visibleEnterpriseNav, visibleSystemNav, visibleWorkspaceNav])

  if (isStudent && !location.pathname.startsWith('/student')) {
    return <Navigate to="/student" replace />
  }

  function toggleCollapse() {
    setCollapsed((value) => !value)
  }

  return (
    <div className={`shell${collapsed && !mobileOpen ? ' is-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} aria-hidden />}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark"><Sparkles size={16} strokeWidth={2.1} /></span>
          {!collapsed && (
            <div className="brand-text">
              <strong>粤教服务</strong>
              <span>智能工作台</span>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {visibleWorkspaceNav.length > 0 && <NavLabel collapsed={collapsed}>工作空间</NavLabel>}
          {visibleWorkspaceNav.map((item) => <NavEntry key={item.to} item={item} collapsed={collapsed} />)}

          {visibleEnterpriseNav.length > 0 && !collapsed && <NavLabel collapsed={false}>企业助手</NavLabel>}
          {visibleEnterpriseNav.length > 0 && !collapsed && (
            <button
              type="button"
              className={`nav-item${location.pathname.startsWith('/enterprise') ? ' active' : ''}`}
              onClick={() => setEnterpriseOpen((value) => !value)}
            >
              <BriefcaseBusiness size={16.5} strokeWidth={1.9} />
              <span>企业助手</span>
              <ChevronDown size={14} className={`chev${enterpriseOpen ? ' open' : ''}`} />
            </button>
          )}
          {!collapsed && enterpriseOpen && (
            <div className="nav-sub">
              {visibleEnterpriseNav.map((item) => <NavEntry key={item.to} item={item} collapsed={false} />)}
            </div>
          )}

          {visibleSystemNav.length > 0 && <NavLabel collapsed={collapsed}>分析与系统</NavLabel>}
          {visibleSystemNav.map((item) => <NavEntry key={item.to} item={item} collapsed={collapsed} />)}
        </nav>

        <div className="sidebar-foot">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="sidebar-user" data-tip={collapsed ? user?.real_name : undefined}>
                <span className="avatar">{(user?.real_name || '未').slice(0, 1)}</span>
                {!collapsed && (
                  <span className="sidebar-user-text">
                    <strong>{user?.real_name || '未登录'}</strong>
                    <span>{user?.department || user?.username || '—'}</span>
                  </span>
                )}
                {!collapsed && <ChevronDown size={14} color="var(--text-4)" />}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu" align="start" sideOffset={8}>
                <div className="menu-head">
                  <strong>{user?.real_name || '未登录'}</strong>
                  <span>{user?.username || '—'}</span>
                </div>
                <div className="menu-sep" role="separator" />
                <DropdownMenu.Item
                  className="menu-item menu-item--danger"
                  onSelect={() => {
                    logout()
                    navigate('/login')
                  }}
                >
                  <LogOut size={14} />退出登录
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            type="button"
            className="sidebar-collapse"
            onClick={toggleCollapse}
            title={collapsed ? '展开侧栏' : '收起侧栏'}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            {!collapsed && <span>收起侧栏</span>}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn topbar-mobile"
              aria-label="打开菜单"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            <nav className="breadcrumb" aria-label="当前位置">
              <span className="crumb-root">粤教服务</span>
              <em>/</em>
              <strong>{title}</strong>
            </nav>
          </div>
          <div className="topbar-right">
            <button type="button" className="topbar-search" onClick={() => setPaletteOpen(true)}>
              <Search size={13} />
              <span>搜索或跳转…</span>
              <kbd>⌘K</kbd>
            </button>
            <span className="topbar-env"><i aria-hidden />本地环境</span>
            <button type="button" className="icon-btn" aria-label="通知" title="通知">
              <Bell size={17} />
            </button>
          </div>
        </header>

        <main className="page">
          <ConfirmProvider>
            <Outlet />
          </ConfirmProvider>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} entries={commandEntries} />
    </div>
  )
}
