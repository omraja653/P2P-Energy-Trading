import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import VerificationGate from './components/VerificationGate.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ConsumerDashboard from './pages/ConsumerDashboard.jsx'
import ProsumerDashboard from './pages/ProsumerDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import TradeHistory from './pages/TradeHistory.jsx'
import Marketplace from './pages/Marketplace.jsx'
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/consumer-dashboard" element={<ConsumerDashboard />} />
        <Route path="/prosumer-dashboard" element={<ProsumerDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
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
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
