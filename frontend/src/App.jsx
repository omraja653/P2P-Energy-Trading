import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import ConsumerDashboard from './pages/ConsumerDashboard.jsx'
import ProsumerDashboard from './pages/ProsumerDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import TradeHistory from './pages/TradeHistory.jsx'
import Marketplace from './pages/Marketplace.jsx'
import NotFound from './pages/NotFound.jsx'
import { useAuth } from './hooks/useAuth.js'

function dashboardPathFor(type) {
  if (type === 'prosumer') return '/prosumer-dashboard'
  if (type === 'admin') return '/admin'
  return '/consumer-dashboard'
}

// "/" has no page of its own — send the visitor to their dashboard (or
// to login if they're not signed in yet).
function HomeRedirect() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={dashboardPathFor(user?.type)} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/consumer-dashboard" element={<ConsumerDashboard />} />
        <Route path="/prosumer-dashboard" element={<ProsumerDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/trade-history" element={<TradeHistory />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
