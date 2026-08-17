import { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { SunIcon, PlugIcon, BoltIcon, CashIcon } from '../components/icons.jsx'
import { formatCurrency, formatKw, formatKwh, formatDate } from '../utils/formatting.js'

function isToday(date) {
  const d = new Date(date)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function ProsumerDashboard() {
  const { user } = useAuth()

  const meter = useFetch('/smartmeter')
  const pricing = useFetch('/pricing/current')
  const listings = useFetch('/pricing/listings')
  const trades = useFetch('/trades')

  const latestReading = meter.data?.[0]
  const surplusKW = latestReading?.surplusKW ?? 0

  const myListings = useMemo(
    () => (listings.data || []).filter((l) => l.prosumerId?._id === user?.id),
    [listings.data, user?.id]
  )

  const mySales = useMemo(
    () =>
      (trades.data || [])
        // sellerId is now populated ({ _id, firstName, lastName }) rather than a raw id string.
        .filter((t) => (t.sellerId?._id || t.sellerId) === user?.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [trades.data, user?.id]
  )

  const todaysSales = useMemo(() => mySales.filter((t) => t.status !== 'cancelled' && isToday(t.createdAt)), [mySales])
  const todaysEarnings = todaysSales.reduce((sum, t) => sum + t.totalAmount, 0)
  const todaysKwh = todaysSales.reduce((sum, t) => sum + t.quantityKWh, 0)
  const avgPricePerKwh = todaysKwh > 0 ? todaysEarnings / todaysKwh : 0
  const gridBuyback = pricing.data?.gridBuybackPrice ?? 0
  const upliftPct = gridBuyback > 0 ? ((avgPricePerKwh - gridBuyback) / gridBuyback) * 100 : 0

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Prosumer Dashboard</h1>
        <p className="text-slate-500">Welcome back, {user?.firstName}.</p>

        {/* Generation / consumption / surplus */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {meter.loading ? (
            <div className="col-span-full"><LoadingSpinner /></div>
          ) : meter.error ? (
            <p className="col-span-full text-red-600">Failed to load meter data.</p>
          ) : (
            <>
              <StatCard
                label="Solar Generation"
                value={formatKw(latestReading?.generationKW)}
                sublabel="right now"
                tone="primary"
                icon={SunIcon}
              />
              <StatCard label="Your Consumption" value={formatKw(latestReading?.consumptionKW)} icon={PlugIcon} />
              <StatCard
                label="Surplus"
                value={formatKw(surplusKW)}
                sublabel={surplusKW > 0 ? 'available to sell' : 'no surplus right now'}
                tone={surplusKW > 0 ? 'success' : 'default'}
                icon={BoltIcon}
              />
            </>
          )}
        </div>

        {/* Listings status */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Active Listings</h2>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {listings.loading ? (
              <LoadingSpinner />
            ) : listings.error ? (
              <p className="text-red-600">Failed to load listings.</p>
            ) : myListings.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active listings. (Note: surplus isn&apos;t auto-listed yet — listings are currently created via seed
                data / admin, not automatically from meter surplus.)
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {myListings.map((l) => (
                  <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="font-medium text-slate-800">
                      {formatKwh(l.quantityKWh)} at {formatCurrency(l.pricePerKwh)}/kWh
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-brand-blue">{l.tradingType}</span>
                      <StatusBadge status={l.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Sales */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">My Sales</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {trades.loading ? (
              <LoadingSpinner />
            ) : trades.error ? (
              <p className="p-4 text-red-600">Failed to load trades.</p>
            ) : mySales.length === 0 ? (
              <p className="p-4 text-slate-500">No sales yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Sold</th>
                    <th className="px-4 py-2.5">Price</th>
                    <th className="px-4 py-2.5">Earned</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mySales.map((t) => (
                    <tr key={t._id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-2.5">{formatKwh(t.quantityKWh)}</td>
                      <td className="px-4 py-2.5">{formatCurrency(t.pricePerKwh)}/kWh</td>
                      <td className="px-4 py-2.5 font-medium text-brand-green">{formatCurrency(t.totalAmount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Today's earnings */}
        <section className="mt-8 rounded-xl border border-brand-green/20 bg-gradient-to-br from-brand-green/10 to-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Today&apos;s Earnings</p>
              <p className="mt-1 text-3xl font-bold text-brand-green">{formatCurrency(todaysEarnings)}</p>
              {pricing.data && todaysKwh > 0 && (
                <p className="mt-1 text-sm text-slate-500">
                  vs {formatCurrency(gridBuyback)}/kWh grid buyback rate —{' '}
                  <span className={upliftPct >= 0 ? 'font-medium text-brand-green' : 'font-medium text-red-600'}>
                    {upliftPct >= 0 ? '+' : ''}
                    {upliftPct.toFixed(0)}% {upliftPct >= 0 ? 'more' : 'less'} than grid {upliftPct >= 0 ? '✓' : ''}
                  </span>
                </p>
              )}
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
              <CashIcon className="h-6 w-6" />
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}

export default ProsumerDashboard
