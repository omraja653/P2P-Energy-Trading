import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { BarChart, LineChart } from '../components/charts.jsx'
import { formatCurrency, formatKwh } from '../utils/formatting.js'
import { fetchRevenue } from '../services/advanced.js'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function RevenueManagement() {
  const { user } = useAuth()
  const [revenue, setRevenue] = useState(null)
  const [error, setError] = useState('')
  const label = user?.type === 'prosumer' ? 'Earnings' : 'Savings'

  useEffect(() => {
    fetchRevenue(currentMonth())
      .then(setRevenue)
      .catch(() => setError('Could not load revenue data.'))
  }, [])

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">💰 Revenue Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user?.type === 'prosumer' ? 'What your solar sales earned' : 'What P2P buying saved you'} this month, computed from
          your real verified/settled trades.
        </p>

        {error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : !revenue ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-brand-green bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-brand-green">{formatCurrency(revenue.totalEarnings)}</p>
                <p className="mt-1 text-xs text-slate-400">This month</p>
              </div>
              <div className="rounded-xl border-2 border-brand-blue bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Total Units Traded</p>
                <p className="mt-1 text-2xl font-bold text-brand-blue">{formatKwh(revenue.totalUnits)}</p>
                <p className="mt-1 text-xs text-slate-400">From {revenue.totalTrades} trade{revenue.totalTrades === 1 ? '' : 's'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-semibold text-orange-700">📊 Best Performing</p>
              <p className="mt-1 text-sm text-orange-700">
                🕐 Best Hour: <strong>{revenue.bestHour != null ? `${revenue.bestHour}:00` : '—'}</strong>
              </p>
              <p className="text-sm text-orange-700">
                📅 Best Day: <strong>{revenue.bestDay || '—'}</strong>
              </p>
            </div>

            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Daily {label}</h2>
              <div className="mt-4">
                <BarChart
                  data={revenue.dailyBreakdown.map((d) => ({ label: d.date.slice(5), value: d.amount }))}
                  valueFormatter={(v) => formatCurrency(v)}
                />
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Hourly {label}</h2>
              <div className="mt-4">
                <LineChart
                  data={revenue.hourlyBreakdown.map((h) => ({ label: `${h.hour}h`, value: h.amount }))}
                  valueFormatter={(v) => formatCurrency(v)}
                />
              </div>
            </section>

            <div className="mt-6 rounded-xl border-2 border-purple-200 bg-purple-50 p-5">
              <h2 className="font-semibold text-purple-800">📈 Next Month Projection</h2>
              <p className="mt-1 text-sm text-purple-700">
                Projected {label.toLowerCase()}: <strong>{formatCurrency(revenue.forecast.nextMonthEarnings)}</strong>
              </p>
              <p className="text-sm text-purple-700">
                Trend: <strong className="uppercase">{revenue.forecast.trend}</strong>{' '}
                {revenue.forecast.trend === 'up' && '📈'}
                {revenue.forecast.trend === 'down' && '📉'}
              </p>
              <p className="mt-2 text-xs text-purple-500">
                A simple +10% extrapolation of this month's total — not a trend model (there's no prior-month history compared).
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default RevenueManagement
