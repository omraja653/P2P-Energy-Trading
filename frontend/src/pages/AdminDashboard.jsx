import { useMemo } from 'react'
import { useFetch } from '../hooks/useFetch.js'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { BarChart, DonutChart } from '../components/charts.jsx'
import { ListIcon, BasketIcon, CashIcon } from '../components/icons.jsx'
import { formatCurrency, formatKwh, formatDate } from '../utils/formatting.js'

function personName(person) {
  if (!person || typeof person !== 'object') return 'Unknown'
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown'
}

function AdminDashboard() {
  const stats = useFetch('/admin/stats')

  const usersByTypeData = useMemo(() => {
    if (!stats.data) return []
    return Object.entries(stats.data.usersByType).map(([label, value]) => ({ label, value }))
  }, [stats.data])

  const volumeChartData = useMemo(() => {
    if (!stats.data) return []
    return stats.data.volumeOverTime.map((row) => ({
      label: row.date.slice(5), // MM-DD
      value: row.total,
    }))
  }, [stats.data])

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500">Platform-wide metrics and management.</p>

        {stats.loading ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : stats.error ? (
          <p className="mt-6 text-red-600">Failed to load admin stats.</p>
        ) : (
          <>
            {/* Top stats */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Total Users" value={stats.data.totalUsers} icon={ListIcon} tone="primary" />
              <StatCard label="Total Trades" value={stats.data.totalTrades} icon={BasketIcon} />
              <StatCard label="Total Volume" value={formatCurrency(stats.data.totalVolume)} icon={CashIcon} tone="success" />
            </div>

            {/* Charts */}
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700">Volume Over Time (last 14 days)</h2>
                <div className="mt-4">
                  <BarChart data={volumeChartData} valueFormatter={(v) => formatCurrency(v)} />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700">Users by Type</h2>
                <div className="mt-4 flex justify-center">
                  <DonutChart data={usersByTypeData} />
                </div>
              </section>
            </div>

            {/* Recent trades */}
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Recent Trades</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                {stats.data.recentTrades.length === 0 ? (
                  <p className="p-4 text-slate-500">No trades yet.</p>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Buyer</th>
                        <th className="px-4 py-2.5">Seller</th>
                        <th className="px-4 py-2.5">Quantity</th>
                        <th className="px-4 py-2.5">Amount</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.data.recentTrades.map((t) => (
                        <tr key={t._id} className="transition hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-500">{formatDate(t.createdAt)}</td>
                          <td className="px-4 py-2.5">{personName(t.buyerId)}</td>
                          <td className="px-4 py-2.5">{personName(t.sellerId)}</td>
                          <td className="px-4 py-2.5">{formatKwh(t.quantityKWh)}</td>
                          <td className="px-4 py-2.5">{formatCurrency(t.totalAmount)}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Dispute management — honest placeholder */}
            <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Dispute Management</h2>
              <p className="mt-2 text-sm text-slate-500">
                There&apos;s no dispute system built yet — trades only have{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">matched / verified / settled / cancelled</code>{' '}
                statuses, with no &quot;disputed&quot; state or admin resolution flow in the data model. This section is a
                placeholder rather than fabricated dispute data.
              </p>
            </section>

            {/* System health — real signals only */}
            <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">System Health</h2>
              <p className="mt-1 text-xs text-slate-400">
                Only real, checkable signals — no fabricated uptime/CPU/memory metrics (nothing in this app measures those).
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <span className="text-sm font-medium text-slate-600">API</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-green">
                    <span className="h-2 w-2 rounded-full bg-brand-green" /> Online
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <span className="text-sm font-medium text-slate-600">Database</span>
                  <span
                    className={`flex items-center gap-1.5 text-sm font-semibold ${
                      stats.data.systemHealth.database === 'connected' ? 'text-brand-green' : 'text-red-600'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${stats.data.systemHealth.database === 'connected' ? 'bg-brand-green' : 'bg-red-600'}`} />
                    {stats.data.systemHealth.database === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard
