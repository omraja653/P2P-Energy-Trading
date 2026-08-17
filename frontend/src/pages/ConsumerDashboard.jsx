import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import { buyEnergy } from '../services/trades.js'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ListingCard from '../components/ListingCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { BoltIcon, PlugIcon, PiggyBankIcon } from '../components/icons.jsx'
import { formatCurrency, formatKw, formatKwh, formatDate } from '../utils/formatting.js'

const ACTIVE_ORDER_STATUSES = ['matched', 'verified']

function ConsumerDashboard() {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [buyingId, setBuyingId] = useState(null)
  const [buyError, setBuyError] = useState('')
  const [buyNotice, setBuyNotice] = useState('')

  const meter = useFetch(`/smartmeter?_r=${refreshKey}`)
  const pricing = useFetch('/pricing/current')
  const listings = useFetch(`/pricing/listings?_r=${refreshKey}`)
  const trades = useFetch(`/trades?_r=${refreshKey}`)

  const latestReading = meter.data?.[0]

  const availableListings = useMemo(() => (listings.data || []).filter((l) => l.status === 'active'), [listings.data])
  const totalAvailableKwh = availableListings.reduce((sum, l) => sum + l.quantityKWh, 0)

  const myPurchases = useMemo(
    () =>
      (trades.data || [])
        // buyerId is now populated ({ _id, firstName, lastName }) rather than a raw id string.
        .filter((t) => (t.buyerId?._id || t.buyerId) === user?.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [trades.data, user?.id]
  )

  const activeOrders = useMemo(
    () => myPurchases.filter((t) => ACTIVE_ORDER_STATUSES.includes(t.status)),
    [myPurchases]
  )

  const monthlySavings = useMemo(() => {
    if (!pricing.data) return 0
    const now = new Date()
    return myPurchases
      .filter((t) => t.status === 'settled' && new Date(t.settledAt || t.createdAt).getMonth() === now.getMonth())
      .reduce((sum, t) => sum + (pricing.data.gridPrice - t.pricePerKwh) * t.quantityKWh, 0)
  }, [myPurchases, pricing.data])

  const monthlyKwh = useMemo(() => {
    const now = new Date()
    return myPurchases
      .filter((t) => t.status === 'settled' && new Date(t.settledAt || t.createdAt).getMonth() === now.getMonth())
      .reduce((sum, t) => sum + t.quantityKWh, 0)
  }, [myPurchases])

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
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Consumer Dashboard</h1>
        <p className="text-slate-500">Welcome back, {user?.firstName}.</p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings.loading ? (
            <LoadingSpinner />
          ) : listings.error ? (
            <p className="text-red-600">Failed to load listings.</p>
          ) : (
            <StatCard
              label="Available Energy"
              value={formatKwh(totalAvailableKwh)}
              sublabel={`${availableListings.length} active listing${availableListings.length === 1 ? '' : 's'}`}
              tone="success"
              icon={BoltIcon}
            />
          )}

          {meter.loading ? (
            <LoadingSpinner />
          ) : meter.error ? (
            <p className="text-red-600">Failed to load meter data.</p>
          ) : (
            <StatCard label="Current Consumption" value={formatKw(latestReading?.consumptionKW)} icon={PlugIcon} />
          )}

          {pricing.loading ? (
            <LoadingSpinner />
          ) : pricing.error ? (
            <p className="text-red-600">Failed to load pricing.</p>
          ) : (
            <>
              <StatCard label="Grid Price" value={`${formatCurrency(pricing.data.gridPrice)}/kWh`} />
              <StatCard label="Your Fair P2P Price" value={`${formatCurrency(pricing.data.fairPrice)}/kWh`} tone="primary" />
            </>
          )}
        </div>

        {/* Available energy to buy */}
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
                  <ListingCard
                    key={listing._id}
                    listing={listing}
                    currentUserId={user?.id}
                    onBuy={handleBuy}
                    buying={buyingId === listing._id}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Active orders */}
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

        {/* Savings calculator */}
        <section className="mt-8 rounded-xl border border-brand-green/20 bg-gradient-to-br from-brand-green/10 to-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">P2P Savings This Month</p>
              <p className="mt-1 text-3xl font-bold text-brand-green">{formatCurrency(monthlySavings)}</p>
              {pricing.data && monthlyKwh > 0 && (
                <p className="mt-1 text-sm text-slate-500">
                  Bought {formatKwh(monthlyKwh)} P2P vs {formatCurrency(pricing.data.gridPrice)}/kWh grid retail —{' '}
                  <span className="font-medium text-brand-green">saving you money on every trade ✓</span>
                </p>
              )}
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
              <PiggyBankIcon className="h-6 w-6" />
            </span>
          </div>
        </section>

        {/* Recent transactions */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {trades.loading ? (
              <LoadingSpinner />
            ) : trades.error ? (
              <p className="p-4 text-red-600">Failed to load trades.</p>
            ) : myPurchases.length === 0 ? (
              <p className="p-4 text-slate-500">No purchases yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Quantity</th>
                    <th className="px-4 py-2.5">Price</th>
                    <th className="px-4 py-2.5">Total</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myPurchases.map((t) => (
                    <tr key={t._id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-2.5">{formatKwh(t.quantityKWh)}</td>
                      <td className="px-4 py-2.5">{formatCurrency(t.pricePerKwh)}/kWh</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{formatCurrency(t.totalAmount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default ConsumerDashboard
