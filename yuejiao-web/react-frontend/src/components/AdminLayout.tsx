import { useEffect } from 'react'
import { Avatar, Badge, Button, Input, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { create } from 'zustand'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTagsStore } from '@/store/tagsStore'
import { selectDisplayName, useAuthStore } from '@/store/authStore'
import { matchRouteMeta } from '@/router/routes'
import {
  Bell,
  Briefcase,
  ChatDotRound,
  DataAnalysis,
  Document,
  Expand,
  Fold,
  Notebook,
  OfficeBuilding,
  Odometer,
  Reading,
  Setting,
  TrendCharts,
  User,
} from '@/components/elementIcons'

// 等价迁移自 layouts/AdminLayout.vue:深色侧栏(220/64 折叠)、分组菜单、
// 面包屑、禁用搜索框、角标铃铛、红底头像 + 退出、tags 多页签。

const MENU_ITEMS: MenuProps['items'] = [
  {
    type: 'group',
    label: '工作台',
    children: [{ key: '/dashboard', icon: <Odometer />, label: '工作台' }],
  },
  {
    type: 'group',
    label: '业务模块 · 后接',
    children: [
      { key: '/profile', icon: <DataAnalysis />, label: '客户研判' },
      { key: '/cs', icon: <ChatDotRound />, label: '客服 Agent' },
      {
        key: 'enterprise',
        icon: <Briefcase />,
        label: '企业助手',
        children: [
          { key: '/enterprise', icon: <ChatDotRound />, label: '对话工作台' },
          { key: '/enterprise/company', icon: <OfficeBuilding />, label: '公司简介' },
          { key: '/enterprise/guide', icon: <Reading />, label: '新人指南' },
          { key: '/enterprise/board', icon: <TrendCharts />, label: '客户看板' },
          { key: '/enterprise/memory', icon: <Notebook />, label: '对话记忆' },
        ],
      },
      {
        key: 'student',
        icon: <User />,
        label: '学生助手',
        children: [
          { key: '/student', icon: <Reading />, label: '学生服务总览' },
          { key: '/student/psych', icon: <ChatDotRound />, label: '心理关怀' },
          { key: '/student/life', icon: <Odometer />, label: '海外生活支持' },
          { key: '/student/program', icon: <TrendCharts />, label: '升学项目咨询' },
        ],
      },
      {
        key: 'report',
        icon: <Document />,
        label: '智能报告',
        children: [
          { key: '/report', label: '报告入口' },
          { key: '/report/customer-ops', label: '全域客户经营分析' },
          { key: '/report/daily-summary', label: '员工日报智能汇总' },
          { key: '/report/psych-weekly', label: '学生心理健康周报' },
          { key: '/report/complaint-weekly', label: '投诉处理周报' },
        ],
      },
    ],
  },
  {
    type: 'group',
    label: '系统',
    children: [{ key: '/settings', icon: <Setting />, label: '设置' }],
  },
]

// 折叠状态:Vue 中为布局内 ref,这里用模块级 store 等价承载
const useCollapsedStore = create<{ collapsed: boolean }>(() => ({ collapsed: false }))

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const meta = matchRouteMeta(pathname)

  const collapsed = useCollapsedStore((state) => state.collapsed)
  const visited = useTagsStore((state) => state.visited)
  const displayName = useAuthStore(selectDisplayName)
  const logout = useAuthStore((state) => state.logout)

  // 对齐 Vue watch(route.path, {immediate:true})
  useEffect(() => {
    useTagsStore.getState().add({ path: pathname, title: matchRouteMeta(pathname).title })
  }, [pathname])

  const openTag = (path: string) => {
    void navigate(path)
  }

  const closeTag = (path: string) => {
    if (path === '/dashboard') return
    const current = pathname === path
    useTagsStore.getState().remove(path)
    if (current) {
      const rest = useTagsStore.getState().visited
      const last = rest[rest.length - 1]
      void navigate(last?.path ?? '/dashboard')
    }
  }

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    void navigate(key)
  }

  return (
    <div className="layout" style={{ display: 'flex' }}>
      <aside className="aside" style={{ width: collapsed ? 64 : 220, flexShrink: 0 }}>
        <div className="logo">
          <span className="mark">粤</span>
          {!collapsed && <strong>粤教服务</strong>}
        </div>
        <Menu
          mode="inline"
          theme="dark"
          inlineCollapsed={collapsed}
          defaultOpenKeys={['enterprise']}
          selectedKeys={[pathname]}
          items={MENU_ITEMS}
          onClick={onMenuClick}
        />
      </aside>
      <div className="content-pane" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <header className="header">
          <Button
            type="text"
            onClick={() => useCollapsedStore.setState({ collapsed: !collapsed })}
            icon={collapsed ? <Expand size={18} /> : <Fold size={18} />}
          />
          <div className="crumb">
            粤教 / 控制台 / <b>{meta.title}</b>
          </div>
          <Input className="search" placeholder="搜索菜单 / 客户 / 工单" disabled />
          <Badge dot>
            <Button type="text" icon={<Bell size={18} />} />
          </Badge>
          <div className="header-user">
            <Avatar size={28}>{displayName.slice(0, 1)}</Avatar>
            <span>{displayName}</span>
            <Button
              type="text"
              onClick={() => {
                logout()
                void navigate('/login')
              }}
            >
              退出
            </Button>
          </div>
        </header>
        <div className="tags">
          {visited.map((tag) => {
            const current = tag.path === pathname
            return (
              <span
                key={tag.path}
                className="nav-tag"
                style={
                  current
                    ? { background: '#fdecec', borderColor: '#f2b8b8', color: '#c41e1e' }
                    : { background: '#fff', borderColor: '#d3d4d6', color: '#909399' }
                }
                onClick={() => openTag(tag.path)}
              >
                {tag.title}
                {tag.path !== '/dashboard' ? (
                  <span
                    className="nav-tag-close"
                    role="button"
                    tabIndex={-1}
                    onClick={(event) => {
                      event.stopPropagation()
                      closeTag(tag.path)
                    }}
                  >
                    ×
                  </span>
                ) : null}
              </span>
            )
          })}
        </div>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
