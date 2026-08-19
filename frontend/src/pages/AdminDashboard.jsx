import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminNav from '../components/AdminNav.jsx'
import MetricsCard from '../components/MetricsCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { BarChart, DonutChart, LineChart } from '../components/charts.jsx'
import { formatCurrency, formatKwh, formatDateTime } from '../utils/formatting.js'
import { timeAgo } from '../utils/timeAgo.js'
import {
  fetchAdminDashboard,
  fetchQuickActions,
  fetchUserAnalytics,
  fetchTradeAnalytics,
  fetchRevenueAnalytics,
  fetchBlockchainAnalytics,
  fetchAdminLogs,
} from '../services/admin.js'

function AdminDashboard() {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetchAdminDashboard(),
      fetchQuickActions(),
      fetchUserAnalytics(30),
      fetchTradeAnalytics(14),
      fetchRevenueAnalytics(),
      fetchBlockchainAnalytics(),
      fetchAdminLogs(10),
    ])
      .then(([metrics, quickActions, userAnalytics, tradeAnalytics, revenue, blockchain, logs]) =>
        setState({ metrics, quickActions, userAnalytics, tradeAnalytics, revenue, blockchain, logs })
      )
      .catch(() => setError('Failed to load admin dashboard.'))
  }, [])

  const growthChartData = useMemo(
    () => state?.userAnalytics.growth.map((r) => ({ label: r.date.slice(5), value: r.cumulativeUsers })) || [],
    [state]
  )
  const volumeChartData = useMemo(
    () => state?.tradeAnalytics.daily.map((r) => ({ label: r.date.slice(5), value: r.volumeKWh })) || [],
    [state]
  )
  const revenuePieData = useMemo(() => {
    if (!state) return []
    const { prosumerAmount, gridWheelAmount, platformAmount } = state.revenue
    return [
      { label: 'Prosumer Pay', value: prosumerAmount },
      { label: 'Grid Wheeling', value: gridWheelAmount },
      { label: 'Platform Earned', value: platformAmount },
    ]
  }, [state])
  const settlementDonutData = useMemo(() => {
    if (!state) return []
    const { completed, pending, failed } = state.blockchain.byStatus
    return [
      { label: 'Success', value: completed },
      { label: 'Pending', value: pending },
      { label: 'Failed', value: failed },
    ]
  }, [state])

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <AdminNav />
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500">Platform-wide metrics and management.</p>

        {error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : !state ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricsCard label="Total Users" value={state.metrics.totalUsers} trend={state.metrics.userGrowthPercent} sublabel="last 30 days" />
              <MetricsCard label="Trades Today" value={state.metrics.tradesToday} />
              <MetricsCard label="Total Volume" value={formatKwh(state.metrics.totalVolumeKWh)} />
              <MetricsCard label="Platform Revenue" value={formatCurrency(state.metrics.platformRevenue)} />
              <MetricsCard label="Active Prosumers" value={state.metrics.activeProsumers} />
              <MetricsCard label="Active Consumers" value={state.metrics.activeConsumers} />
              <MetricsCard
                label="Settlement Success"
                value={state.metrics.settlementSuccessRate != null ? `${state.metrics.settlementSuccessRate}%` : '—'}
              />
              <MetricsCard
                label="Avg Support Response"
                value={state.metrics.avgSupportResponseHours != null ? `${state.metrics.avgSupportResponseHours}h` : '—'}
              />
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-700">User Growth (30 days)</h2>
                    <div className="mt-4"><LineChart data={growthChartData} /></div>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-700">Daily Trade Volume (14 days)</h2>
                    <div className="mt-4"><BarChart data={volumeChartData} valueFormatter={(v) => formatKwh(v)} /></div>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-700">Revenue Breakdown</h2>
                    <div className="mt-4 flex justify-center"><DonutChart data={revenuePieData} /></div>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-700">Settlement Status</h2>
                    <div className="mt-4 flex justify-center"><DonutChart data={settlementDonutData} /></div>
                  </section>
                </div>

                {/* Recent activity feed */}
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-700">Recent Admin Activity</h2>
                  {state.logs.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-400">No admin actions logged yet.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {state.logs.map((log) => (
                        <li key={log._id} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <span className="font-medium text-slate-700">{log.adminId?.firstName || 'Admin'}</span>{' '}
                            <span className="text-slate-500">{log.action}</span>
                            {log.details && <span className="text-slate-400"> — {log.details}</span>}
                          </div>
                          <span className="shrink-0 text-xs text-slate-400" title={formatDateTime(log.createdAt)}>
                            {timeAgo(log.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* Quick actions sidebar */}
              <aside className="space-y-3">
                <Link to="/admin/kyc" className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                  <p className="text-xs font-medium text-slate-500">Pending KYC</p>
                  <p className="mt-1 text-xl font-bold text-orange-500">{state.quickActions.pendingKycCount}</p>
                </Link>
                <Link to="/admin/trades?status=disputed" className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                  <p className="text-xs font-medium text-slate-500">Disputed Trades</p>
                  <p className="mt-1 text-xl font-bold text-red-500">{state.quickActions.disputedTradesCount}</p>
                </Link>
                <Link to="/support-dashboard" className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                  <p className="text-xs font-medium text-slate-500">Open Support Tickets</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {Object.entries(state.quickActions.openTicketsByPriority).length === 0 ? (
                      <span className="text-slate-400">None open</span>
                    ) : (
                      Object.entries(state.quickActions.openTicketsByPriority).map(([priority, count]) => (
                        <span key={priority} className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {priority}: {count}
                        </span>
                      ))
                    )}
                  </div>
                </Link>
                <Link to="/admin/system-health" className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                  <p className="text-xs font-medium text-slate-500">System Health Check</p>
                  <p className="mt-1 text-sm font-semibold text-brand-blue">View status →</p>
                </Link>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard
