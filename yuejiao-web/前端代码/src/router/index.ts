import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login/index.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      component: AdminLayout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/dashboard/index.vue'),
          meta: { title: '工作台', hint: '空白工作台。接 FastAPI 后再放待办和数字。' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/profile/index.vue'),
          meta: { title: '客户研判', hint: '文本 / PDF / Excel 客户画像研判，接入 Dify 工作流。' },
        },
        {
          path: 'cs',
          name: 'cs',
          component: () => import('@/views/cs/index.vue'),
          meta: { title: '客服 Agent', hint: '正式聊天在右下角粤小蜜，本页不是对话入口。' },
        },
        {
          path: 'enterprise',
          name: 'enterprise',
          component: () => import('@/views/enterprise/index.vue'),
          meta: { title: '企业助手', hint: '口述录入、查询、日报、请假审批。' },
        },
        {
          path: 'enterprise/company',
          name: 'enterprise-company',
          component: () => import('@/views/enterprise/company.vue'),
          meta: { title: '公司简介', hint: '粤教服务企业信息。' },
        },
        {
          path: 'enterprise/guide',
          name: 'enterprise-guide',
          component: () => import('@/views/enterprise/guide.vue'),
          meta: { title: '新人指南', hint: '入职办公与 IT 指引。' },
        },
        {
          path: 'enterprise/board',
          name: 'enterprise-board',
          component: () => import('@/views/enterprise/board.vue'),
          meta: { title: '客户看板', hint: '线索漏斗与意向国家。' },
        },
        {
          path: 'enterprise/memory',
          name: 'enterprise-memory',
          component: () => import('@/views/enterprise/memory.vue'),
          meta: { title: '对话记忆', hint: '企业助手会话历史，刷新仍在。' },
        },
        {
          path: 'student',
          name: 'student',
          component: () => import('@/views/student/index.vue'),
          meta: { title: '学生助手', hint: '空白模版。以后接请假、心理、投诉、考务、进度。' },
        },
        {
          path: 'student/psych',
          name: 'student-psych',
          component: () => import('@/views/student/chat.vue'),
          meta: { title: '心理关怀', assistantMode: 'psych' },
        },
        {
          path: 'student/life',
          name: 'student-life',
          component: () => import('@/views/student/chat.vue'),
          meta: { title: '海外生活支持', assistantMode: 'life' },
        },
        {
          path: 'student/program',
          name: 'student-program',
          component: () => import('@/views/student/chat.vue'),
          meta: { title: '升学项目咨询', assistantMode: 'program' },
        },
        {
          path: 'report',
          name: 'report',
          component: () => import('@/views/report/index.vue'),
          meta: { title: '智能报告', hint: '客户经营、日报汇总、心理/投诉周报。' },
        },
        {
          path: 'report/customer-ops',
          name: 'report-customer-ops',
          component: () => import('@/views/report/customer-ops.vue'),
          meta: { title: '全域客户经营分析' },
        },
        {
          path: 'report/daily-summary',
          name: 'report-daily-summary',
          component: () => import('@/views/report/daily-summary.vue'),
          meta: { title: '员工日报智能汇总' },
        },
        {
          path: 'report/psych-weekly',
          name: 'report-psych-weekly',
          component: () => import('@/views/report/psych-weekly.vue'),
          meta: { title: '学生心理健康周报' },
        },
        {
          path: 'report/complaint-weekly',
          name: 'report-complaint-weekly',
          component: () => import('@/views/report/complaint-weekly.vue'),
          meta: { title: '投诉处理周报' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/settings/index.vue'),
          meta: { title: '设置', hint: '空白槽。以后接账号、角色、组织。' },
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('yuejiao_token')
  if (to.meta.public) return true
  if (!token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  const rawUser = localStorage.getItem('yuejiao_user')
  const user = rawUser ? JSON.parse(rawUser) as { user_type?: string } : null
  if (to.path.startsWith('/enterprise') && user?.user_type === 'student') {
    return '/student'
  }
  return true
})

export default router
