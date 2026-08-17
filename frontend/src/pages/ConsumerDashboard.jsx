import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import { buyEnergy } from '../services/trades.js'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ListingCard from '../components/ListingCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatKw, formatKwh, formatDate } from '../utils/formatting.js'

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

  const myPurchases = useMemo(
    () => (trades.data || []).filter((t) => t.buyerId === user?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [trades.data, user?.id]
  )

  const monthlySavings = useMemo(() => {
    if (!pricing.data) return 0
    const now = new Date()
    return myPurchases
      .filter((t) => t.status === 'settled' && new Date(t.settledAt || t.createdAt).getMonth() === now.getMonth())
      .reduce((sum, t) => sum + (pricing.data.gridPrice - t.pricePerKwh) * t.quantityKWh, 0)
  }, [myPurchases, pricing.data])

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
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Consumer Dashboard</h1>
      <p className="text-slate-500">Welcome back, {user?.firstName}.</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {meter.loading ? (
          <div className="col-span-full"><LoadingSpinner /></div>
        ) : meter.error ? (
          <p className="col-span-full text-red-600">Failed to load meter data.</p>
        ) : (
          <StatCard label="Current Consumption" value={formatKw(latestReading?.consumptionKW)} tone="primary" />
        )}

        {pricing.loading ? (
          <LoadingSpinner />
        ) : pricing.error ? (
          <p className="text-red-600">Failed to load pricing.</p>
        ) : (
          <>
            <StatCard label="Grid Price" value={`${formatCurrency(pricing.data.gridPrice)}/kWh`} />
            <StatCard label="Your Fair P2P Price" value={`${formatCurrency(pricing.data.fairPrice)}/kWh`} tone="success" />
            <StatCard label="P2P Savings This Month" value={formatCurrency(monthlySavings)} tone="success" />
          </>
        )}
      </div>

      {/* Listings */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Available Energy to Buy</h2>

        {buyNotice && <p className="mt-2 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{buyNotice}</p>}
        {buyError && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{buyError}</p>}

        <div className="mt-4">
          {listings.loading ? (
            <LoadingSpinner />
          ) : listings.error ? (
            <p className="text-red-600">Failed to load listings.</p>
          ) : listings.data.length === 0 ? (
            <p className="text-slate-500">No active listings right now — check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.data.map((listing) => (
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

      {/* Purchases */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">My Recent Purchases</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
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
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Quantity</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myPurchases.map((t) => (
                  <tr key={t._id}>
                    <td className="px-4 py-2 text-slate-500">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-2">{formatKwh(t.quantityKWh)}</td>
                    <td className="px-4 py-2">{formatCurrency(t.pricePerKwh)}/kWh</td>
                    <td className="px-4 py-2">{formatCurrency(t.totalAmount)}</td>
                    <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

export default ConsumerDashboard
