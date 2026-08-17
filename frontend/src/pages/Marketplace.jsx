import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import { buyEnergy } from '../services/trades.js'
import StatCard from '../components/StatCard.jsx'
import ListingCard from '../components/ListingCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatKwh, formatDateTime } from '../utils/formatting.js'

function Marketplace() {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [buyingId, setBuyingId] = useState(null)
  const [buyError, setBuyError] = useState('')
  const [buyNotice, setBuyNotice] = useState('')

  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minQuantity, setMinQuantity] = useState('')

  const pricing = useFetch('/pricing/current')
  const listings = useFetch(`/pricing/listings?_r=${refreshKey}`)

  const filteredListings = useMemo(() => {
    return (listings.data || []).filter((l) => {
      if (minPrice && l.pricePerKwh < Number(minPrice)) return false
      if (maxPrice && l.pricePerKwh > Number(maxPrice)) return false
      if (minQuantity && l.quantityKWh < Number(minQuantity)) return false
      return true
    })
  }, [listings.data, minPrice, maxPrice, minQuantity])

  function resetFilters() {
    setMinPrice('')
    setMaxPrice('')
    setMinQuantity('')
  }

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
      <h1 className="text-2xl font-bold text-slate-900">P2P Energy Marketplace</h1>

      {/* Market overview */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pricing.loading ? (
          <div className="col-span-full"><LoadingSpinner /></div>
        ) : pricing.error ? (
          <p className="col-span-full text-red-600">Failed to load market stats.</p>
        ) : (
          <>
            <StatCard label="Fair P2P Price" value={`${formatCurrency(pricing.data.fairPrice)}/kWh`} tone="primary" />
            <StatCard label="Total Supply" value={formatKwh(pricing.data.totalSupplyKWh)} sublabel={`${pricing.data.activeListings} active listings`} />
            <StatCard label="Matched Today" value={formatKwh(pricing.data.matchedTodayKWh)} tone="success" />
            <StatCard label="Grid Price" value={`${formatCurrency(pricing.data.gridPrice)}/kWh`} sublabel="benchmark" />
          </>
        )}
      </div>
      {pricing.data && (
        <p className="mt-2 text-right text-xs text-slate-400">Last updated: {formatDateTime(pricing.data.updatedAt)}</p>
      )}

      {/* Filters */}
      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Filter Listings</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500">Min price ($/kWh)</label>
            <input
              type="number" step="0.01" min="0.08" max="0.20"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="0.08"
              className="mt-1 w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Max price ($/kWh)</label>
            <input
              type="number" step="0.01" min="0.08" max="0.20"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="0.20"
              className="mt-1 w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Min quantity (kWh)</label>
            <input
              type="number" step="0.1" min="0"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              placeholder="0"
              className="mt-1 w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      </section>

      {/* Listings */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Available Listings</h2>

        {buyNotice && <p className="mt-2 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{buyNotice}</p>}
        {buyError && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{buyError}</p>}

        <div className="mt-4">
          {listings.loading ? (
            <LoadingSpinner />
          ) : listings.error ? (
            <p className="text-red-600">Failed to load listings.</p>
          ) : filteredListings.length === 0 ? (
            <p className="text-slate-500">No listings match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((listing) => (
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
    </div>
  )
}

export default Marketplace
