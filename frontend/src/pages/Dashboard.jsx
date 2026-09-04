import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import { buyEnergy } from '../services/trades.js'
import { fetchDashboard } from '../services/dashboard.js'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ListingCard from '../components/ListingCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ForecastCard from '../components/ForecastCard.jsx'
import RecentActivityCard from '../components/RecentActivityCard.jsx'
import TradeSummaryCard from '../components/TradeSummaryCard.jsx'
import { SunIcon, PlugIcon, BoltIcon, PiggyBankIcon } from '../components/icons.jsx'
import { formatCurrency, formatKw, formatKwh, formatDate } from '../utils/formatting.js'

const ACTIVE_ORDER_STATUSES = ['matched', 'verified']
const DASHBOARD_REFRESH_MS = 10000

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function isToday(date) {
  return new Date(date).toDateString() === new Date().toDateString()
}

function Dashboard() {
  const { user } = useAuth()
  const isProsumer = user?.type === 'prosumer'
  const [refreshKey, setRefreshKey] = useState(0)
  const [buyingId, setBuyingId] = useState(null)
  const [buyError, setBuyError] = useState('')
  const [buyNotice, setBuyNotice] = useState('')
  const [dash, setDash] = useState(null)

  const meter = useFetch(`/smartmeter?_r=${refreshKey}`)
  const listings = useFetch(`/pricing/listings?_r=${refreshKey}`)
  const trades = useFetch(`/trades?_r=${refreshKey}`)

  // Forecast + recent activity auto-refresh every 10s, per spec — cheap
  // since forecastService caches per-day and revenueService/trades are
  // already fast real-time queries, not expensive recomputation.
  useEffect(() => {
    let cancelled = false
    function load() {
      fetchDashboard()
        .then((data) => !cancelled && setDash(data))
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, DASHBOARD_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const latestReading = meter.data?.[0]

  // --- Consumer-specific derived data ---------------------------------------
  const availableListings = useMemo(() => (listings.data || []).filter((l) => l.status === 'active'), [listings.data])
  const myPurchases = useMemo(
    () =>
      (trades.data || [])
        .filter((t) => (t.buyerId?._id || t.buyerId) === user?.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [trades.data, user?.id]
  )
  const activeOrders = useMemo(() => myPurchases.filter((t) => ACTIVE_ORDER_STATUSES.includes(t.status)), [myPurchases])

  // --- Prosumer-specific derived data ---------------------------------------
  const surplusKW = latestReading?.surplusKW ?? 0
  const myListings = useMemo(
    () => (listings.data || []).filter((l) => l.prosumerId?._id === user?.id),
    [listings.data, user?.id]
  )
  const mySales = useMemo(
    () =>
      (trades.data || [])
        .filter((t) => (t.sellerId?._id || t.sellerId) === user?.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [trades.data, user?.id]
  )
  const todaysSales = useMemo(() => mySales.filter((t) => t.status !== 'cancelled' && isToday(t.createdAt)), [mySales])
  const todaysEarnings = todaysSales.reduce((sum, t) => sum + t.totalAmount, 0)

  async function handleBuy(listing) {
    setBuyError('')
    setBuyNotice('')
    setBuyingId(listing._id)
    try {
      const result = await buyEnergy({ quantityKWh: listing.quantityKWh, tradingType: listing.tradingType })
      if (result.trades?.length) {
        setBuyNotice(`Bought ${formatKwh(listing.quantityKWh)} from ${listing.prosumerId?.firstName || 'prosumer'}.`)
      } else {
        setBuyNotice('No match found — try again in a moment.')
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setBuyError(err.response?.data?.error || 'Purchase failed. Please try again.')
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl p-3 sm:p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {greeting()}, {user?.firstName}
            </h1>
            {user?.location?.city && <p className="text-sm text-slate-500">📍 {user.location.city}</p>}
          </div>
        </div>

        {/* Role-specific top stats — the real meter/pricing data the old
            per-role dashboards showed, kept as-is. */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meter.loading ? (
            <div className="col-span-full"><LoadingSpinner /></div>
          ) : meter.error ? (
            <p className="col-span-full text-red-600">Failed to load meter data.</p>
          ) : isProsumer ? (
            <>
              <StatCard label="Solar Generation" value={formatKw(latestReading?.generationKW)} sublabel="right now" tone="primary" icon={SunIcon} />
              <StatCard label="Your Consumption" value={formatKw(latestReading?.consumptionKW)} icon={PlugIcon} />
              <StatCard
                label="Surplus"
                value={formatKw(surplusKW)}
                sublabel={surplusKW > 0 ? 'available to sell' : 'no surplus right now'}
                tone={surplusKW > 0 ? 'success' : 'default'}
                icon={BoltIcon}
              />
            </>
          ) : (
            <>
              <StatCard
                label="Available Energy"
                value={formatKwh(availableListings.reduce((sum, l) => sum + l.quantityKWh, 0))}
                sublabel={`${availableListings.length} active listing${availableListings.length === 1 ? '' : 's'}`}
                tone="success"
                icon={BoltIcon}
              />
              <StatCard label="Current Consumption" value={formatKw(latestReading?.consumptionKW)} icon={PlugIcon} />
              <StatCard label={`Today's ${isProsumer ? 'Earnings' : 'Spend'}`} value={formatCurrency(todaysEarnings)} icon={PiggyBankIcon} />
            </>
          )}
        </div>

        {/* New cards */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ForecastCard forecast={dash?.forecast} userType={user?.type} />
          <RecentActivityCard activity={dash?.recentActivity} />
        </div>

        <div className="mt-6">
          <TradeSummaryCard userType={user?.type} />
        </div>

        {/* Role-specific content */}
        {isProsumer ? (
          <>
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Active Listings</h2>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                {listings.loading ? (
                  <LoadingSpinner />
                ) : listings.error ? (
                  <p className="text-red-600">Failed to load listings.</p>
                ) : myListings.length === 0 ? (
                  <p className="text-sm text-slate-500">No active listings yet.</p>
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
                      {mySales.slice(0, 10).map((t) => (
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
          </>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Available Energy to Buy</h2>
              {buyNotice && <p className="mt-2 rounded-lg bg-brand-green/10 px-3 py-2 text-sm text-brand-green">{buyNotice}</p>}
              {buyError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{buyError}</p>}
              <div className="mt-4">
                {listings.loading ? (
                  <LoadingSpinner />
                ) : listings.error ? (
                  <p className="text-red-600">Failed to load listings.</p>
                ) : availableListings.length === 0 ? (
                  <p className="text-slate-500">No active listings right now — check back soon.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {availableListings.map((listing) => (
                      <ListingCard key={listing._id} listing={listing} currentUserId={user?.id} onBuy={handleBuy} buying={buyingId === listing._id} />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Active Orders</h2>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                {trades.loading ? (
                  <LoadingSpinner />
                ) : trades.error ? (
                  <p className="text-red-600">Failed to load orders.</p>
                ) : activeOrders.length === 0 ? (
                  <p className="text-sm text-slate-500">No orders in progress — trades you place will show here until settled.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {activeOrders.map((t) => (
                      <li key={t._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <span className="font-medium text-slate-800">
                          {formatKwh(t.quantityKWh)} at {formatCurrency(t.pricePerKwh)}/kWh
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-500">{formatCurrency(t.totalAmount)}</span>
                          <StatusBadge status={t.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard
