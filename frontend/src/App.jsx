import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import VerificationGate from './components/VerificationGate.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ConsumerDashboard from './pages/ConsumerDashboard.jsx'
import ProsumerDashboard from './pages/ProsumerDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminKyc from './pages/AdminKyc.jsx'
import AdminTrades from './pages/AdminTrades.jsx'
import AdminSettlements from './pages/AdminSettlements.jsx'
import AdminReports from './pages/AdminReports.jsx'
import AdminSystemHealth from './pages/AdminSystemHealth.jsx'
import AdminSettings from './pages/AdminSettings.jsx'
import TradeHistory from './pages/TradeHistory.jsx'
import Marketplace from './pages/Marketplace.jsx'
import SupportCenter from './pages/SupportCenter.jsx'
import TicketDetail from './pages/TicketDetail.jsx'
import SupportDashboard from './pages/SupportDashboard.jsx'
import SupportTicketDetail from './pages/SupportTicketDetail.jsx'
import UserProfile from './pages/UserProfile.jsx'
import NotFound from './pages/NotFound.jsx'
import { useAuth } from './hooks/useAuth.js'
import { dashboardPathFor } from './utils/dashboardPath.js'

// "/" has no page of its own — send the visitor to their dashboard, to
// role selection first if they're authenticated but typeless (routed via
// /login, which shows RoleSelector for that case), or to login if they're
// not signed in yet.
function HomeRedirect() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={dashboardPathFor(user?.type) || '/login'} replace />
}

// The backend already 403s non-agents on every /support/admin/* call, but
// bouncing them client-side avoids a page full of error text for a route
// they were never meant to land on.
function RequireAgent({ children }) {
  const { user } = useAuth()
  if (user?.type !== 'support' && user?.type !== 'admin') {
    return <Navigate to={dashboardPathFor(user?.type) || '/login'} replace />
  }
  return children
}

function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (user?.type !== 'admin') {
    return <Navigate to={dashboardPathFor(user?.type) || '/login'} replace />
  }
  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/consumer-dashboard" element={<ConsumerDashboard />} />
        <Route path="/prosumer-dashboard" element={<ProsumerDashboard />} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="/admin/kyc" element={<RequireAdmin><AdminKyc /></RequireAdmin>} />
        <Route path="/admin/trades" element={<RequireAdmin><AdminTrades /></RequireAdmin>} />
        <Route path="/admin/settlements" element={<RequireAdmin><AdminSettlements /></RequireAdmin>} />
        <Route path="/admin/reports" element={<RequireAdmin><AdminReports /></RequireAdmin>} />
        <Route path="/admin/system-health" element={<RequireAdmin><AdminSystemHealth /></RequireAdmin>} />
        <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
        <Route
          path="/marketplace"
          element={
            <VerificationGate>
              <Marketplace />
            </VerificationGate>
          }
        />
        <Route
          path="/trade-history"
          element={
            <VerificationGate>
              <TradeHistory />
            </VerificationGate>
          }
        />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/support" element={<SupportCenter />} />
        <Route path="/support/tickets/:ticketId" element={<TicketDetail />} />
        <Route
          path="/support-dashboard"
          element={
            <RequireAgent>
              <SupportDashboard />
            </RequireAgent>
          }
        />
        <Route
          path="/support-dashboard/tickets/:ticketId"
          element={
            <RequireAgent>
              <SupportTicketDetail />
            </RequireAgent>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
