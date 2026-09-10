import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AdminLayout } from '@/components/AdminLayout'

// 路由级代码分割：登录页与各业务页按需加载
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const CsPage = lazy(() => import('@/pages/CsPage').then((m) => ({ default: m.CsPage })))
const EnterprisePage = lazy(() => import('@/pages/EnterprisePage').then((m) => ({ default: m.EnterprisePage })))
const EnterpriseCompanyPage = lazy(() => import('@/pages/EnterpriseCompanyPage').then((m) => ({ default: m.EnterpriseCompanyPage })))
const EnterpriseGuidePage = lazy(() => import('@/pages/EnterpriseGuidePage').then((m) => ({ default: m.EnterpriseGuidePage })))
const EnterpriseBoardPage = lazy(() => import('@/pages/EnterpriseBoardPage').then((m) => ({ default: m.EnterpriseBoardPage })))
const EnterpriseMemoryPage = lazy(() => import('@/pages/EnterpriseMemoryPage').then((m) => ({ default: m.EnterpriseMemoryPage })))
const StudentPage = lazy(() => import('@/pages/StudentPage').then((m) => ({ default: m.StudentPage })))
const StudentChatPage = lazy(() => import('@/pages/StudentChatPage').then((m) => ({ default: m.StudentChatPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ReportHubPage = lazy(() => import('@/pages/ReportHubPage').then((m) => ({ default: m.ReportHubPage })))
const CustomerOpsPage = lazy(() => import('@/pages/report/CustomerOpsPage').then((m) => ({ default: m.CustomerOpsPage })))
const DailySummaryPage = lazy(() => import('@/pages/report/DailySummaryPage').then((m) => ({ default: m.DailySummaryPage })))
const PsychWeeklyPage = lazy(() => import('@/pages/report/PsychWeeklyPage').then((m) => ({ default: m.PsychWeeklyPage })))
const ComplaintWeeklyPage = lazy(() => import('@/pages/report/ComplaintWeeklyPage').then((m) => ({ default: m.ComplaintWeeklyPage })))

function PageFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 280, color: 'var(--text-4)', fontSize: 13 }}>
      <span className="spinner" style={{ width: 18, height: 18, border: '2px solid var(--border-strong)', borderTopColor: 'var(--brand)', borderRadius: '50%' }} />
    </div>
  )
}

function ProtectedRoute() {
  const token = useAuthStore((state) => state.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  return (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  )
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
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageFallback />}>
            <LoginPage />
          </Suspense>
        }
      />
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
            <Route path="student/psych" element={<StudentChatPage mode="psych" />} />
            <Route path="student/life" element={<StudentChatPage mode="life" />} />
            <Route path="student/program" element={<StudentChatPage mode="program" />} />
            <Route path="report" element={<ReportHubPage />} />
            <Route path="report/customer-ops" element={<CustomerOpsPage />} />
            <Route path="report/daily-summary" element={<DailySummaryPage />} />
            <Route path="report/psych-weekly" element={<PsychWeeklyPage />} />
            <Route path="report/complaint-weekly" element={<ComplaintWeeklyPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
