import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import { buyEnergy } from '../services/trades.js'
import { fetchActiveBids, fetchSlotsForDate, placeFullDayBid, cancelBid } from '../services/advanced.js'
import { getSocket, disconnectSocket } from '../services/socket.js'
import StatCard from '../components/StatCard.jsx'
import ListingCard from '../components/ListingCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import CreateBidModal from '../components/CreateBidModal.jsx'
import { formatCurrency, formatKwh, formatDateTime } from '../utils/formatting.js'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'quantity-high', label: 'Quantity: High to Low' },
]

function Marketplace() {
  const { user } = useAuth()
  const isProsumer = user?.type === 'prosumer'
  const [buyingId, setBuyingId] = useState(null)
  const [buyError, setBuyError] = useState('')
  const [buyNotice, setBuyNotice] = useState('')

  const pricing = useFetch('/pricing/current')
  const listings = useFetch('/pricing/listings')

  const [showCreateBid, setShowCreateBid] = useState(false)
  const [myBids, setMyBids] = useState(null)
  const [bidNotice, setBidNotice] = useState('')
  const [sellBids, setSellBids] = useState(null)
  // Real fix for the actual gap here: this page used to only ever fetch
  // sell-side bids, so a prosumer never saw outstanding buy demand at
  // all — not a "wrong filter" bug, a missing data source, same shape as
  // the earlier sell-bid-visibility fix. `fetchSlotsForDate` already
  // supports `?bidType=buy` server-side; this is a client-only addition,
  // no backend change needed.
  const [buyBids, setBuyBids] = useState(null)

  // Filters/sort/search — client-side over the already-small fetched set,
  // same pattern TradeHistory/Orders already uses, rather than adding new
  // backend query params for a dataset this size.
  const [bidTypeFilter, setBidTypeFilter] = useState('all') // 'all' | 'sell' | 'buy'
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [search, setSearch] = useState('')

  function loadMyBids() {
    fetchActiveBids()
      .then(setMyBids)
      .catch(() => {})
  }

  function loadSellBids() {
    const today = new Date().toISOString().slice(0, 10)
    fetchSlotsForDate(today, 'sell')
      .then(setSellBids)
      .catch(() => setSellBids([]))
  }

  function loadBuyBids() {
    const today = new Date().toISOString().slice(0, 10)
    fetchSlotsForDate(today, 'buy')
      .then(setBuyBids)
      .catch(() => setBuyBids([]))
  }

  // One-time initial load, then WebSocket takes over — no setInterval
  // polling and no manual Refresh button. `new-bid`/`bid-matched`/
  // `bid-cancelled` are broadcast to every connected client, so another
  // user's action shows up here live; this page's own actions (buy/cancel/
  // create below) still update local state directly since that response
  // is already in hand synchronously.
  useEffect(() => {
    loadMyBids()
    loadSellBids()
    loadBuyBids()

    const socket = getSocket()
    socket.connect()

    function onNewBid(bid) {
      const setter = bid.bidType === 'sell' ? setSellBids : bid.bidType === 'buy' ? setBuyBids : null
      if (!setter) return
      setter((prev) => {
        const list = prev || []
        if (list.some((b) => b._id === bid._id)) return list
        return [...list, bid]
      })
    }

    function onBidMatched({ bidIds }) {
      setSellBids((prev) => (prev || []).filter((b) => !bidIds.includes(b._id)))
      setBuyBids((prev) => (prev || []).filter((b) => !bidIds.includes(b._id)))
      setMyBids((prev) => (prev || []).filter((b) => !bidIds.includes(b._id)))
    }

    function onBidCancelled({ bidId }) {
      setSellBids((prev) => (prev || []).filter((b) => b._id !== bidId))
      setBuyBids((prev) => (prev || []).filter((b) => b._id !== bidId))
      setMyBids((prev) => (prev || []).filter((b) => b._id !== bidId))
    }

    socket.on('new-bid', onNewBid)
    socket.on('bid-matched', onBidMatched)
    socket.on('bid-cancelled', onBidCancelled)

    return () => {
      socket.off('new-bid', onNewBid)
      socket.off('bid-matched', onBidMatched)
      socket.off('bid-cancelled', onBidCancelled)
      disconnectSocket()
    }
  }, [])

  function handleBidCreated(bid) {
    setShowCreateBid(false)
    loadMyBids()
    loadSellBids()
    loadBuyBids()
    setBidNotice(
      bid.matched
        ? `Matched! ${formatKwh(bid.executedQuantity)} at ${formatCurrency(bid.executedPrice)}/kWh.`
        : 'Bid placed — waiting for a match.'
    )
  }

  async function handleCancelBid(id) {
    try {
      await cancelBid(id)
      loadMyBids()
      loadSellBids()
      loadBuyBids()
    } catch {
      // Best-effort — the bid just stays listed if the cancel call fails.
    }
  }

  // Merges every real data source into one displayable, filterable list:
  // EnergyListing docs (bought via the matching-engine flow), pending
  // sell TradingSlots (bought by placing an opposing buy bid), and now
  // pending buy TradingSlots too (fulfilled by placing an opposing sell
  // bid) — the actual double-auction view, both directions visible to
  // everyone. `source` is what handleBuy/action-visibility branch on.
  const combinedListings = useMemo(() => {
    const listingItems = (listings.data || []).map((l) => ({ ...l, source: 'listing', bidSide: 'sell' }))
    const sellBidItems = (sellBids || []).map((b) => ({
      _id: b._id,
      prosumerId: b.userId,
      quantityKWh: b.bidQuantity,
      pricePerKwh: b.bidPrice,
      tradingType: b.tradingType || 'intraday',
      status: 'active',
      createdAt: b.createdAt,
      source: 'bid',
      bidSide: 'sell',
    }))
    const buyBidItems = (buyBids || []).map((b) => ({
      _id: b._id,
      counterpartyId: b.userId,
      counterpartyLabel: 'Consumer',
      quantityKWh: b.bidQuantity,
      pricePerKwh: b.bidPrice,
      tradingType: b.tradingType || 'intraday',
      status: 'active',
      createdAt: b.createdAt,
      source: 'buy-bid',
      bidSide: 'buy',
    }))
    return [...listingItems, ...sellBidItems, ...buyBidItems]
  }, [listings.data, sellBids, buyBids])

  const filteredListings = useMemo(() => {
    const term = search.trim().toLowerCase()
    let result = combinedListings.filter((l) => {
      if (bidTypeFilter !== 'all' && l.bidSide !== bidTypeFilter) return false
      if (minPrice && l.pricePerKwh < Number(minPrice)) return false
      if (maxPrice && l.pricePerKwh > Number(maxPrice)) return false
      if (term) {
        const counterparty = l.counterpartyId ?? l.prosumerId
        const name = `${counterparty?.firstName || ''} ${counterparty?.lastName || ''}`.toLowerCase()
        if (!name.includes(term)) return false
      }
      return true
    })

    switch (sortBy) {
      case 'price-low':
        result = [...result].sort((a, b) => a.pricePerKwh - b.pricePerKwh)
        break
      case 'price-high':
        result = [...result].sort((a, b) => b.pricePerKwh - a.pricePerKwh)
        break
      case 'quantity-high':
        result = [...result].sort((a, b) => b.quantityKWh - a.quantityKWh)
        break
      case 'newest':
      default:
        result = [...result].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return result
  }, [combinedListings, bidTypeFilter, minPrice, maxPrice, sortBy, search])

  // Real market stats — computed from the actual fetched sell/buy bids,
  // not a fabricated aggregate. Scoped to the TradingSlot order book
  // (sellBids/buyBids), not the legacy EnergyListing path, since that's
  // the one with two real, comparable sides to spread against each other.
  const marketStats = useMemo(() => {
    const sells = sellBids || []
    const buys = buyBids || []
    const avg = (arr) => (arr.length ? arr.reduce((sum, b) => sum + b.bidPrice, 0) / arr.length : null)
    const avgSell = avg(sells)
    const avgBuy = avg(buys)
    return {
      total: sells.length + buys.length,
      sellCount: sells.length,
      buyCount: buys.length,
      avgSell,
      avgBuy,
      spread: avgSell != null && avgBuy != null ? avgBuy - avgSell : null,
    }
  }, [sellBids, buyBids])

  function resetFilters() {
    setBidTypeFilter('all')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('newest')
    setSearch('')
  }

  async function handleBuy(listing) {
    setBuyError('')
    setBuyNotice('')
    setBuyingId(listing._id)
    try {
      if (listing.source === 'bid') {
        // Places a real opposing buy bid at the shown price — guaranteed to
        // match immediately (same price never fails the "seller asks <=
        // buyer offers" check), same auto-match pipeline the /bid page
        // uses. Note: same caveat the EnergyListing path already has —
        // this isn't a guaranteed "take this exact bid" action, the match
        // engine pairs against whichever pending sell bid is cheapest, so
        // if a cheaper one appeared in the meantime, that's the one filled.
        const result = await placeFullDayBid({
          tradingType: listing.tradingType,
          bidQuantity: listing.quantityKWh,
          bidPrice: listing.pricePerKwh,
          bidType: 'buy',
        })
        if (result.matched) {
          setBuyNotice(`Bought ${formatKwh(result.executedQuantity)} at ${formatCurrency(result.executedPrice)}/kWh.`)
        } else {
          setBuyNotice('Bid placed — waiting for a match.')
        }
      } else if (listing.source === 'buy-bid') {
        // Symmetric action for a prosumer fulfilling real buy demand —
        // same real, atomic matching pipeline, just placing the opposing
        // side (sell). Same "best price wins, not literally this exact
        // bid" caveat as above.
        const result = await placeFullDayBid({
          tradingType: listing.tradingType,
          bidQuantity: listing.quantityKWh,
          bidPrice: listing.pricePerKwh,
          bidType: 'sell',
        })
        if (result.matched) {
          setBuyNotice(`Sold ${formatKwh(result.executedQuantity)} at ${formatCurrency(result.executedPrice)}/kWh.`)
        } else {
          setBuyNotice('Bid placed — waiting for a match.')
        }
      } else {
        const result = await buyEnergy({ quantityKWh: listing.quantityKWh, tradingType: listing.tradingType })
        if (result.trades?.length) {
          setBuyNotice(`Bought ${formatKwh(listing.quantityKWh)} from ${listing.prosumerId?.firstName || 'prosumer'}.`)
        } else {
          setBuyNotice('No match found — try again in a moment.')
        }
      }
      loadSellBids()
      loadBuyBids()
      loadMyBids()
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">P2P Energy Marketplace</h1>
            <p className="text-sm text-slate-500">
              Instant matching — every pending sell and buy bid, visible to everyone, paired the moment prices cross.
            </p>
            <p className="mt-1 text-sm">
              <Link to="/auction" className="font-medium text-teal-600 underline">
                Prefer one fair clearing price for everyone? Try the Double Auction →
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateBid(true)}
            style={{ backgroundColor: 'rgb(0, 150, 135)' }}
            className="min-h-[44px] w-full rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 sm:min-h-0 sm:w-auto"
          >
            + Create Bid
          </button>
        </div>

        {bidNotice && <p className="mt-4 rounded-lg bg-brand-green/10 px-3 py-2 text-sm text-brand-green">{bidNotice}</p>}
        {buyNotice && <p className="mt-4 rounded-lg bg-brand-green/10 px-3 py-2 text-sm text-brand-green">{buyNotice}</p>}
        {buyError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{buyError}</p>}

        {/* Market stats — real numbers from the actual pending TradingSlot
            bids, not a fabricated aggregate. */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active Bids" value={marketStats.total} />
          <StatCard label="Sell Bids" value={marketStats.sellCount} tone="success" />
          <StatCard label="Buy Bids" value={marketStats.buyCount} tone="primary" />
          <StatCard
            label="Price Spread"
            value={marketStats.spread != null ? formatCurrency(marketStats.spread) : '—'}
            sublabel={
              marketStats.avgSell != null && marketStats.avgBuy != null
                ? `avg sell ${formatCurrency(marketStats.avgSell)} · avg buy ${formatCurrency(marketStats.avgBuy)}`
                : 'not enough data yet'
            }
          />
        </div>

        {/* Your own bids awaiting a match — a different store (TradingSlot)
            than the EnergyListing cards below, so shown as its own strip
            rather than mixed into that grid. Updates live via WebSocket
            (bid-matched/bid-cancelled) as well as your own actions here. */}
        {myBids && myBids.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Your Active Bids</h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {myBids.map((bid) => (
                <li key={bid._id} className="flex flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-700">
                    {bid.bidType === 'sell' ? '🔻 Sell' : '🔺 Buy'} {formatKwh(bid.bidQuantity)} @ {formatCurrency(bid.bidPrice)}/kWh
                    <span className="ml-1 text-xs text-slate-400">({bid.tradingType === 'dayahead' ? 'day-ahead' : 'intraday'})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCancelBid(bid._id)}
                    className="min-h-[44px] w-full rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 sm:min-h-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Filters — client-side over the already-fetched set. */}
        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border-t-4 border-teal bg-white p-4 shadow-sm">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'sell', label: 'Sell' },
              { value: 'buy', label: 'Buy' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBidTypeFilter(opt.value)}
                className={`min-h-[44px] rounded px-3 py-1 text-sm font-medium transition sm:min-h-0 ${
                  bidTypeFilter === opt.value ? 'bg-teal text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Min ₹/kWh</label>
            <input
              type="number" step="0.01" min="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="mt-1 w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Max ₹/kWh</label>
            <input
              type="number" step="0.01" min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="mt-1 w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="block text-xs font-medium text-slate-500">Search by name</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Alice"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:min-h-0"
          >
            Reset
          </button>
        </div>

        {/* Active Energy Bids — both directions, pushed in real time over
            WebSocket. */}
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Active Energy Bids</h2>
            <span className="text-sm text-slate-500">{filteredListings.length} result{filteredListings.length === 1 ? '' : 's'}</span>
          </div>

          <div className="mt-4">
            {listings.loading || sellBids === null || buyBids === null ? (
              <LoadingSpinner />
            ) : listings.error ? (
              <p className="text-red-600">Failed to load listings.</p>
            ) : filteredListings.length === 0 ? (
              <p className="text-slate-500">No bids match your filters right now.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredListings.map((listing) => {
                  // A sell-side card can only be acted on by a consumer; a
                  // buy-side card only by a prosumer — real role
                  // enforcement mirrors what the backend already requires
                  // (routes/slots.js's expectedBidType check), not just a
                  // UI nicety.
                  const disabledLabel =
                    listing.bidSide === 'sell' && isProsumer
                      ? 'Consumers only'
                      : listing.bidSide === 'buy' && !isProsumer
                        ? 'Prosumers only'
                        : undefined
                  return (
                    <ListingCard
                      key={listing._id}
                      listing={listing}
                      currentUserId={user?.id}
                      onBuy={handleBuy}
                      buying={buyingId === listing._id}
                      gridPrice={pricing.data?.gridPrice}
                      actionLabel={listing.bidSide === 'buy' ? 'Sell to Match' : 'Buy Now'}
                      disabledLabel={disabledLabel}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Stats — moved to the bottom per redesign, so the live bids are
            the first thing seen rather than being pushed below the fold. */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      {showCreateBid && <CreateBidModal onClose={() => setShowCreateBid(false)} onCreated={handleBidCreated} />}
    </div>
  )
}

export default Marketplace
