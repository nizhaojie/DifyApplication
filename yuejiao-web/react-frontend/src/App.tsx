import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LoginPage } from '@/pages/LoginPage'
import { AdminLayout } from '@/components/AdminLayout'
import { EnterprisePage } from '@/pages/EnterprisePage'
import { EnterpriseBoardPage } from '@/pages/EnterpriseBoardPage'
import { EnterpriseCompanyPage } from '@/pages/EnterpriseCompanyPage'
import { EnterpriseGuidePage } from '@/pages/EnterpriseGuidePage'
import { EnterpriseMemoryPage } from '@/pages/EnterpriseMemoryPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { CsPage } from '@/pages/CsPage'
import { StudentPage } from '@/pages/StudentPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ReportHubPage } from '@/pages/ReportHubPage'
import { ReportPage } from '@/pages/ReportPage'

function ProtectedRoute() {
  const token = useAuthStore((state) => state.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function RouteShell() {
  const navigate = useNavigate()
  useEffect(() => {
    const path = window.location.pathname
    if (path === '/') navigate('/dashboard', { replace: true })
  }, [navigate])
  return <Outlet />
}

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate)
  useEffect(() => { void hydrate() }, [hydrate])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<RouteShell />}>
          <Route element={<AdminLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="cs" element={<CsPage />} />
            <Route path="enterprise" element={<EnterprisePage />} />
            <Route path="enterprise/company" element={<EnterpriseCompanyPage />} />
            <Route path="enterprise/guide" element={<EnterpriseGuidePage />} />
            <Route path="enterprise/board" element={<EnterpriseBoardPage />} />
            <Route path="enterprise/memory" element={<EnterpriseMemoryPage />} />
            <Route path="student" element={<StudentPage />} />
            <Route path="report" element={<ReportHubPage />} />
            <Route path="report/customer-ops" element={<ReportPage kind="customer_ops" />} />
            <Route path="report/daily-summary" element={<ReportPage kind="daily_summary" />} />
            <Route path="report/psych-weekly" element={<ReportPage kind="psych_weekly" />} />
            <Route path="report/complaint-weekly" element={<ReportPage kind="complaint_weekly" />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
