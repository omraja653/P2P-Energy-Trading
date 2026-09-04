import { useEffect, useState } from 'react'
import { formatCurrency, formatKwh } from '../utils/formatting.js'
import { fetchRevenue } from '../services/advanced.js'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function TradeSummaryCard({ userType }) {
  const [month, setMonth] = useState(currentMonth())
  const [revenue, setRevenue] = useState(null)
  const [error, setError] = useState('')
  const isProsumer = userType === 'prosumer'

  useEffect(() => {
    setRevenue(null)
    fetchRevenue(month)
      .then(setRevenue)
      .catch(() => setError('Could not load trade summary.'))
  }, [month])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Trade Summary</h2>
        <input
          type="month"
          value={month}
          max={currentMonth()}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-teal focus:outline-none"
        />
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : !revenue ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {isProsumer ? (
            <>
              <div>
                <p className="text-xs text-slate-400">Total Energy Sold</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatKwh(revenue.totalUnits)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Earnings</p>
                <p className="mt-0.5 font-semibold text-brand-green">{formatCurrency(revenue.totalEarnings)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Pending</p>
                <p className="mt-0.5 font-semibold text-orange-500">{formatCurrency(revenue.pending)}</p>
                <p className="text-[11px] text-slate-400">matched, not yet verified</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-slate-400">Total Energy Bought</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatKwh(revenue.totalUnits)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Savings</p>
                <p className="mt-0.5 font-semibold text-brand-green">{formatCurrency(revenue.totalEarnings)}</p>
                <p className="text-[11px] text-slate-400">vs grid rate</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Amount Spent</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatCurrency(revenue.totalSpent)}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default TradeSummaryCard
