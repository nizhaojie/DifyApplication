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
          meta: { title: '客户研判', hint: '空白模版。以后接文本 / PDF / Excel 解析和匹配结果。' },
        },
        {
          path: 'cs',
          name: 'cs',
          component: () => import('@/views/cs/index.vue'),
          meta: { title: '客服 Agent', hint: '空白模版。以后接咨询问答、荐课、活动报名。' },
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
          path: 'report',
          name: 'report',
          component: () => import('@/views/report/index.vue'),
          meta: { title: '智能报告', hint: '空白模版。以后接客户经营、日报汇总、心理/投诉周报。' },
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
  return true
})

export default router
