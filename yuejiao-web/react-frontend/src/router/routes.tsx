import type { ReactNode } from 'react'
import { matchPath } from 'react-router-dom'

// 等价迁移自 Vue 版 src/router/index.ts 的路由表与 meta。
// meta 仅四类:title / hint / public / assistantMode(Vue 无角色权限系统)。

export interface RouteMeta {
  title: string
  hint?: string
  public?: boolean
  assistantMode?: 'psych' | 'life' | 'program'
}

export interface AppRouteConfig {
  path: string
  meta: RouteMeta
  /** AdminLayout 的 children 使用;lazy 由 React.lazy 在 App.tsx 处理 */
  element?: ReactNode
}

/** AdminLayout 下的 18 条扁平 children(顺序与 Vue 一致) */
export const LAYOUT_ROUTE_META: Record<string, RouteMeta> = {
  '/dashboard': { title: '工作台', hint: '空白工作台。接 FastAPI 后再放待办和数字。' },
  '/profile': { title: '客户研判', hint: '文本 / PDF / Excel 客户画像研判,接入 Dify 工作流。' },
  '/cs': { title: '客服 Agent', hint: '空白模版。以后接咨询问答、荐课、活动报名。' },
  '/enterprise': { title: '企业助手', hint: '口述录入、查询、日报、请假审批。' },
  '/enterprise/company': { title: '公司简介', hint: '粤教服务企业信息。' },
  '/enterprise/guide': { title: '新人指南', hint: '入职办公与 IT 指引。' },
  '/enterprise/board': { title: '客户看板', hint: '线索漏斗与意向国家。' },
  '/enterprise/memory': { title: '对话记忆', hint: '企业助手会话历史,刷新仍在。' },
  '/student': { title: '学生助手', hint: '空白模版。以后接请假、心理、投诉、考务、进度。' },
  '/student/psych': { title: '心理关怀', assistantMode: 'psych' },
  '/student/life': { title: '海外生活支持', assistantMode: 'life' },
  '/student/program': { title: '升学项目咨询', assistantMode: 'program' },
  '/report': { title: '智能报告', hint: '客户经营、日报汇总、心理/投诉周报。' },
  '/report/customer-ops': { title: '全域客户经营分析' },
  '/report/daily-summary': { title: '员工日报智能汇总' },
  '/report/psych-weekly': { title: '学生心理健康周报' },
  '/report/complaint-weekly': { title: '投诉处理周报' },
  '/settings': { title: '设置', hint: '空白槽。以后接账号、角色、组织。' },
}

export const LOGIN_META: RouteMeta = { title: '登录', public: true }

/** 等价 Vue 的 route.meta.title 读取:按最长前缀匹配 meta 表,兜底「工作台」 */
export function matchRouteMeta(pathname: string): RouteMeta {
  let best: { path: string; meta: RouteMeta } | null = null
  for (const [path, meta] of Object.entries(LAYOUT_ROUTE_META)) {
    if (matchPath(path, pathname) && (!best || path.length > best.path.length)) {
      best = { path, meta }
    }
  }
  if (best) return best.meta
  if (matchPath('/login', pathname)) return LOGIN_META
  return { title: '工作台' }
}
