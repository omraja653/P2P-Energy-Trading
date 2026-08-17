import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import { buyEnergy } from '../services/trades.js'
import StatCard from '../components/StatCard.jsx'
import ListingCard from '../components/ListingCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatKwh, formatDateTime } from '../utils/formatting.js'

const SORT_OPTIONS = [
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'quantity-desc', label: 'Quantity: Most Available' },
  { value: 'quantity-asc', label: 'Quantity: Least Available' },
]
// No "sort by rating" option — there's no seller-rating system in this app
// yet, and fabricating one to sort by would be worse than not offering it.

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function Marketplace() {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [buyingId, setBuyingId] = useState(null)
  const [buyError, setBuyError] = useState('')
  const [buyNotice, setBuyNotice] = useState('')

  const [search, setSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [sort, setSort] = useState('price-asc')

  const pricing = useFetch('/pricing/current')
  const listings = useFetch(`/pricing/listings?_r=${refreshKey}`)

  const filteredListings = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = (listings.data || []).filter((l) => {
      if (minPrice && l.pricePerKwh < Number(minPrice)) return false
      if (maxPrice && l.pricePerKwh > Number(maxPrice)) return false
      if (minQuantity && l.quantityKWh < Number(minQuantity)) return false
      if (term) {
        const name = `${l.prosumerId?.firstName || ''} ${l.prosumerId?.lastName || ''}`.toLowerCase()
        if (!name.includes(term)) return false
      }
      return true
    })

    const sorted = [...filtered]
    switch (sort) {
      case 'price-desc':
        sorted.sort((a, b) => b.pricePerKwh - a.pricePerKwh)
        break
      case 'quantity-desc':
        sorted.sort((a, b) => b.quantityKWh - a.quantityKWh)
        break
      case 'quantity-asc':
        sorted.sort((a, b) => a.quantityKWh - b.quantityKWh)
        break
      case 'price-asc':
      default:
        sorted.sort((a, b) => a.pricePerKwh - b.pricePerKwh)
    }
    return sorted
  }, [listings.data, search, minPrice, maxPrice, minQuantity, sort])

  function resetFilters() {
    setSearch('')
    setMinPrice('')
    setMaxPrice('')
    setMinQuantity('')
    setSort('price-asc')
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
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
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

        {buyNotice && <p className="mt-4 rounded-lg bg-brand-green/10 px-3 py-2 text-sm text-brand-green">{buyNotice}</p>}
        {buyError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{buyError}</p>}

        {/* Body: filter sidebar + listings */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {/* Filter sidebar */}
          <aside className="h-fit rounded-xl border-t-4 border-teal bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Filter Listings</h2>

            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-500">Search prosumer</label>
              <div className="relative mt-1">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. Alice"
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-500">Sort by</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-500">Min $/kWh</label>
                <input
                  type="number" step="0.01" min="0.08" max="0.20"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0.08"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Max $/kWh</label>
                <input
                  type="number" step="0.01" min="0.08" max="0.20"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="0.20"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-500">Min quantity (kWh)</label>
              <input
                type="number" step="0.1" min="0"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </aside>

          {/* Listings */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Available Listings</h2>
              <span className="text-sm text-slate-500">{filteredListings.length} result{filteredListings.length === 1 ? '' : 's'}</span>
            </div>

            <div className="mt-4">
              {listings.loading ? (
                <LoadingSpinner />
              ) : listings.error ? (
                <p className="text-red-600">Failed to load listings.</p>
              ) : filteredListings.length === 0 ? (
                <p className="text-slate-500">No listings match your filters.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredListings.map((listing) => (
                    <ListingCard
                      key={listing._id}
                      listing={listing}
                      currentUserId={user?.id}
                      onBuy={handleBuy}
                      buying={buyingId === listing._id}
                      gridPrice={pricing.data?.gridPrice}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Marketplace
