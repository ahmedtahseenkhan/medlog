import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import { SessionGuard } from './components/auth/SessionGuard'
import LoginPage from './pages/Login'
import SignupPage from './pages/Signup'
import VerifyEmailPage from './pages/VerifyEmail'
import DashboardPage from './pages/Dashboard'
import PatientsPage from './pages/Patients'
import PatientDetailPage from './pages/PatientDetail'
import AnalyticsPage from './pages/Analytics'
import AuditLogPage from './pages/AuditLog'
import SettingsPage from './pages/Settings'
import SharedViewPage from './pages/SharedView'
import ConsultsPage from './pages/Consults'
import PrescriptionsPage from './pages/Prescriptions'
import AppointmentsPage from './pages/Appointments'
import Layout from './components/Layout'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <SessionGuard>{children}</SessionGuard> : <Navigate to="/login" replace />
}

function LoginPageWithTimeout() {
  const [params] = useSearchParams()
  return <LoginPage timeoutMessage={params.get('reason') === 'timeout' ? 'Session expired due to inactivity' : undefined} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPageWithTimeout />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        {/* Public — no auth required */}
        <Route path="/share/:token" element={<SharedViewPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="consults" element={<ConsultsPage />} />
          <Route path="prescriptions" element={<PrescriptionsPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="audit-log" element={<AuditLogPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
