import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LoginPage } from '@/pages/LoginPage'
import { AdminLayout } from '@/components/AdminLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { CsPage } from '@/pages/CsPage'
import { EnterprisePage } from '@/pages/EnterprisePage'
import { EnterpriseCompanyPage } from '@/pages/EnterpriseCompanyPage'
import { EnterpriseGuidePage } from '@/pages/EnterpriseGuidePage'
import { EnterpriseBoardPage } from '@/pages/EnterpriseBoardPage'
import { EnterpriseMemoryPage } from '@/pages/EnterpriseMemoryPage'
import { StudentPage } from '@/pages/StudentPage'
import { StudentChatPage } from '@/pages/StudentChatPage'
import { ReportHubPage } from '@/pages/ReportHubPage'
import { ReportPage } from '@/pages/ReportPage'
import { SettingsPage } from '@/pages/SettingsPage'

// 等价迁移自 Vue 版 src/router/index.ts:19 条路由、/ → /dashboard、
// 守卫未登录带 ?redirect= 回跳、无 404(未知路径保留布局、内容空白,与 Vue 一致)。

function ProtectedRoute() {
  const token = useAuthStore((state) => state.token)
  const location = useLocation()
  if (!token) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <Outlet />
}

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="cs" element={<CsPage />} />
          <Route path="enterprise" element={<EnterprisePage />} />
          <Route path="enterprise/company" element={<EnterpriseCompanyPage />} />
          <Route path="enterprise/guide" element={<EnterpriseGuidePage />} />
          <Route path="enterprise/board" element={<EnterpriseBoardPage />} />
          <Route path="enterprise/memory" element={<EnterpriseMemoryPage />} />
          <Route path="student" element={<StudentPage />} />
          <Route path="student/psych" element={<StudentChatPage mode="psych" />} />
          <Route path="student/life" element={<StudentChatPage mode="life" />} />
          <Route path="student/program" element={<StudentChatPage mode="program" />} />
          <Route path="report" element={<ReportHubPage />} />
          <Route path="report/customer-ops" element={<ReportPage kind="customer_ops" />} />
          <Route path="report/daily-summary" element={<ReportPage kind="daily_summary" />} />
          <Route path="report/psych-weekly" element={<ReportPage kind="psych_weekly" />} />
          <Route path="report/complaint-weekly" element={<ReportPage kind="complaint_weekly" />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<></>} />
        </Route>
      </Route>
    </Routes>
  )
}
