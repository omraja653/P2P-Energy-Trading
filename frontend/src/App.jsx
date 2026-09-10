import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import VerificationGate from './components/VerificationGate.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Wallet from './pages/Wallet.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminKyc from './pages/AdminKyc.jsx'
import AdminTrades from './pages/AdminTrades.jsx'
import AdminSettlements from './pages/AdminSettlements.jsx'
import AdminReports from './pages/AdminReports.jsx'
import AdminSystemHealth from './pages/AdminSystemHealth.jsx'
import AdminSettings from './pages/AdminSettings.jsx'
import TradeHistory from './pages/TradeHistory.jsx'
// pages/Marketplace.jsx (the EnergyListing "Buy Now" grid) and pages/Bid.jsx
// / pages/SlotTrading.jsx (instant bid/ask) are intentionally no longer
// imported or routed — the double auction (AuctionMarket) is the single
// trading mechanism. The files are kept for reference / quick rollback.
import SupportCenter from './pages/SupportCenter.jsx'
import TicketDetail from './pages/TicketDetail.jsx'
import SupportDashboard from './pages/SupportDashboard.jsx'
import SupportTicketDetail from './pages/SupportTicketDetail.jsx'
import UserProfile from './pages/UserProfile.jsx'
import ForecastDashboard from './pages/ForecastDashboard.jsx'
import AuctionMarket from './pages/AuctionMarket.jsx'
import RevenueManagement from './pages/RevenueManagement.jsx'
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

// Forecast/slots/revenue are trading features — the backend already 403s
// admin/support on all three, this just avoids showing them an error page.
function RequireTrader({ children }) {
  const { user } = useAuth()
  if (user?.type !== 'consumer' && user?.type !== 'prosumer') {
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
        <Route
          path="/dashboard"
          element={
            <RequireTrader>
              <Dashboard />
            </RequireTrader>
          }
        />
        <Route
          path="/wallet"
          element={
            <RequireTrader>
              <Wallet />
            </RequireTrader>
          }
        />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="/admin/kyc" element={<RequireAdmin><AdminKyc /></RequireAdmin>} />
        <Route path="/admin/trades" element={<RequireAdmin><AdminTrades /></RequireAdmin>} />
        <Route path="/admin/settlements" element={<RequireAdmin><AdminSettlements /></RequireAdmin>} />
        <Route path="/admin/reports" element={<RequireAdmin><AdminReports /></RequireAdmin>} />
        <Route path="/admin/system-health" element={<RequireAdmin><AdminSystemHealth /></RequireAdmin>} />
        <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
        {/* The marketplace IS the periodic double auction now — it's the
            single trading mechanism. AuctionMarket renders here under the
            plain "/marketplace" path (Navbar's "Marketplace" tab already
            points at it). The older instant-match surfaces (the
            EnergyListing "Buy Now" grid in pages/Marketplace.jsx, and the
            /bid + /slots bid pages) are unrouted below but their code and
            backend routes are kept intact/dormant — re-adding a <Route> is
            all it takes to bring any of them back. */}
        <Route
          path="/marketplace"
          element={
            <RequireTrader>
              <VerificationGate>
                <AuctionMarket />
              </VerificationGate>
            </RequireTrader>
          }
        />
        {/* Old bookmarks / the previous "Try the Double Auction" link. */}
        <Route path="/auction" element={<Navigate to="/marketplace" replace />} />
        <Route
          path="/trade-history"
          element={
            <VerificationGate>
              <TradeHistory />
            </VerificationGate>
          }
        />
        {/* /orders is the same real page as /trade-history (linked from the
            Navbar as "Orders" already) — an alias, not a second Orders
            page, so there's one implementation to keep in sync rather than
            two that drift apart. */}
        <Route path="/orders" element={<Navigate to="/trade-history" replace />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route
          path="/forecast"
          element={
            <RequireTrader>
              <ForecastDashboard />
            </RequireTrader>
          }
        />
        <Route
          path="/revenue"
          element={
            <RequireTrader>
              <RevenueManagement />
            </RequireTrader>
          }
        />
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
