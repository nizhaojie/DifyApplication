import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
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
          meta: { title: '企业助手', hint: '空白模版。以后接意向录入、查询、日报、审批。' },
        },
        {
          path: 'student',
          name: 'student',
          component: () => import('@/views/student/index.vue'),
          meta: { title: '学生助手', hint: '空白模版。以后接请假、心理、投诉、考务、进度。' },
        },
        {
          path: 'report',
          redirect: '/report/customer-ops',
          children: [
            {
              path: 'customer-ops',
              name: 'report-customer-ops',
              component: () => import('@/views/report/customer-ops.vue'),
              meta: { title: '全域客户经营分析' },
            },
            {
              path: 'daily-summary',
              name: 'report-daily-summary',
              component: () => import('@/views/report/daily-summary.vue'),
              meta: { title: '员工日报智能汇总' },
            },
            {
              path: 'psych-weekly',
              name: 'report-psych-weekly',
              component: () => import('@/views/report/psych-weekly.vue'),
              meta: { title: '学生心理健康周报' },
            },
            {
              path: 'complaint-weekly',
              name: 'report-complaint-weekly',
              component: () => import('@/views/report/complaint-weekly.vue'),
              meta: { title: '投诉处理周报' },
            },
          ],
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

export default router
