import { useEffect, useMemo, useState } from 'react'
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

function Marketplace() {
  const { user } = useAuth()
  const [buyingId, setBuyingId] = useState(null)
  const [buyError, setBuyError] = useState('')
  const [buyNotice, setBuyNotice] = useState('')

  const pricing = useFetch('/pricing/current')
  const listings = useFetch('/pricing/listings')

  const [showCreateBid, setShowCreateBid] = useState(false)
  const [myBids, setMyBids] = useState(null)
  const [bidNotice, setBidNotice] = useState('')
  const [sellBids, setSellBids] = useState(null)

  function loadMyBids() {
    fetchActiveBids()
      .then(setMyBids)
      .catch(() => {})
  }

  // Sell bids from the /bid page's TradingSlot store — a completely
  // separate collection from EnergyListing (the grid below). Without this
  // fetch, a prosumer's "Create Bid" sell order never appeared here at
  // all, which was the actual bug: not a status/filter issue, a missing
  // data source. Only 'pending' sell bids for today (see
  // slotMatchingService.getSlotsByDate) — a matched/cancelled one no
  // longer shows as available.
  function loadSellBids() {
    const today = new Date().toISOString().slice(0, 10)
    fetchSlotsForDate(today, 'sell')
      .then(setSellBids)
      .catch(() => setSellBids([]))
  }

  // One-time initial load, then WebSocket takes over — no setInterval
  // polling and no manual Refresh button (removed per the real-time
  // rewrite). `new-bid`/`bid-matched`/`bid-cancelled` are broadcast to
  // every connected client, so another user's action shows up here live;
  // this page's own actions (buy/cancel/create below) still update local
  // state directly since that response is already in hand synchronously.
  useEffect(() => {
    loadMyBids()
    loadSellBids()

    const socket = getSocket()
    socket.connect()

    function onNewBid(bid) {
      if (bid.bidType !== 'sell') return
      setSellBids((prev) => {
        const list = prev || []
        if (list.some((b) => b._id === bid._id)) return list
        return [...list, bid]
      })
    }

    function onBidMatched({ bidIds }) {
      setSellBids((prev) => (prev || []).filter((b) => !bidIds.includes(b._id)))
      setMyBids((prev) => (prev || []).filter((b) => !bidIds.includes(b._id)))
    }

    function onBidCancelled({ bidId }) {
      setSellBids((prev) => (prev || []).filter((b) => b._id !== bidId))
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
    } catch {
      // Best-effort — the bid just stays listed if the cancel call fails.
    }
  }

  // Merges the two real data sources into one displayable list: EnergyListing
  // docs (prosumer listings, bought via the existing matching-engine flow)
  // and pending TradingSlot sell bids (bought by placing an opposing buy
  // bid via the same auto-match pipeline the /bid page uses). Normalized to
  // one shape so ListingCard doesn't need to know which source a card came
  // from — `source`/`sourceId` on each item is what handleBuy branches on.
  const combinedListings = useMemo(() => {
    const listingItems = (listings.data || []).map((l) => ({ ...l, source: 'listing' }))
    const bidItems = (sellBids || []).map((b) => ({
      _id: b._id,
      prosumerId: b.userId,
      quantityKWh: b.bidQuantity,
      pricePerKwh: b.bidPrice,
      tradingType: b.tradingType || 'intraday',
      status: 'active',
      createdAt: b.createdAt,
      source: 'bid',
    }))
    const combined = [...listingItems, ...bidItems]
    return combined.sort((a, b) => a.pricePerKwh - b.pricePerKwh)
  }, [listings.data, sellBids])

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
      } else {
        const result = await buyEnergy({ quantityKWh: listing.quantityKWh, tradingType: listing.tradingType })
        if (result.trades?.length) {
          setBuyNotice(`Bought ${formatKwh(listing.quantityKWh)} from ${listing.prosumerId?.firstName || 'prosumer'}.`)
        } else {
          setBuyNotice('No match found — try again in a moment.')
        }
      }
      loadSellBids()
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
          <h1 className="text-2xl font-bold text-slate-900">P2P Energy Marketplace</h1>
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

        {/* Active Energy Bids — live sell listings from prosumers, pushed in
            real time over WebSocket (no filter sidebar, kept simple). */}
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Active Energy Bids</h2>
            <span className="text-sm text-slate-500">{combinedListings.length} result{combinedListings.length === 1 ? '' : 's'}</span>
          </div>

          <div className="mt-4">
            {listings.loading || sellBids === null ? (
              <LoadingSpinner />
            ) : listings.error ? (
              <p className="text-red-600">Failed to load listings.</p>
            ) : combinedListings.length === 0 ? (
              <p className="text-slate-500">No active bids right now.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {combinedListings.map((listing) => (
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
