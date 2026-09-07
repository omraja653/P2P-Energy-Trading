import { useState } from 'react'
import { formatCurrency, formatKwh, formatDateTime } from '../utils/formatting.js'

const TRADING_TYPE_LABELS = {
  intraday: 'Intraday',
  dayahead: 'Day-Ahead',
}

// `gridPrice` is optional — when given, the price highlights green if this
// listing beats the grid retail rate.
//
// Shared by two directions now, not just "consumer buys a prosumer's
// listing": a sell-side card (EnergyListing, or a pending sell
// TradingSlot) still reads `listing.prosumerId` by default, but a buy-side
// card (a pending buy TradingSlot, shown so a prosumer can see real demand
// — see Marketplace.jsx) passes `counterpartyId`/`counterpartyLabel`/
// `actionLabel` instead, so the same card renders "Consumer: Bob — Sell to
// Match" rather than "Prosumer: X — Buy Now". `disabledLabel` covers "this
// card exists but your role can't act on it" (e.g. a consumer viewing
// another consumer's buy bid) — a real, different case from "it's yours".
function ListingCard({
  listing,
  currentUserId,
  onBuy,
  buying,
  gridPrice,
  actionLabel = 'Buy Now',
  disabledLabel,
}) {
  const [showDetails, setShowDetails] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const counterparty = listing.counterpartyId ?? listing.prosumerId
  const counterpartyRoleLabel = listing.counterpartyLabel ?? 'Prosumer'
  const counterpartyName = counterparty ? `${counterparty.firstName} ${counterparty.lastName}` : 'Unknown'
  const isOwnListing = counterparty?._id === currentUserId
  const beatsGrid = typeof gridPrice === 'number' && listing.pricePerKwh < gridPrice
  const savingsVsGrid = beatsGrid ? (gridPrice - listing.pricePerKwh) * listing.quantityKWh : null

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-lg">
      <div>
        <div className="relative inline-block">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            className="text-sm text-slate-500 underline decoration-dotted underline-offset-2"
          >
            {counterpartyRoleLabel}: <span className="font-medium text-slate-700">{counterpartyName}</span>
          </button>

          {/* Seller info tooltip — no rating shown: there's no seller-rating
              system in this app yet (flagged rather than faked). */}
          {showTooltip && (
            <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg bg-slate-900 p-3 text-xs text-white shadow-xl">
              <p className="font-semibold">{counterpartyName}</p>
              <p className="mt-1 text-white/70">Listed {formatDateTime(listing.createdAt)}</p>
              <p className="mt-1 text-white/70 capitalize">{TRADING_TYPE_LABELS[listing.tradingType] || listing.tradingType} market</p>
            </div>
          )}
        </div>

        <p className="mt-2 text-lg font-semibold text-slate-900">{formatKwh(listing.quantityKWh)}</p>
        <p className={`text-sm font-medium ${beatsGrid ? 'text-brand-green' : 'text-slate-600'}`}>
          {formatCurrency(listing.pricePerKwh)}/kWh
          {beatsGrid && <span className="ml-1 text-xs">▼ below grid</span>}
        </p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-brand-blue">
          {TRADING_TYPE_LABELS[listing.tradingType] || listing.tradingType}
        </p>
        {savingsVsGrid != null && (
          <p className="mt-1 text-xs font-medium text-brand-green">Savings vs grid: {formatCurrency(savingsVsGrid)}</p>
        )}

        {showDetails && (
          <div className="mt-3 rounded bg-slate-50 p-3 text-xs text-slate-500">
            <p>Listing ID: {listing._id}</p>
            <p>Total: {formatCurrency(listing.quantityKWh * listing.pricePerKwh)}</p>
            <p>Listed: {formatDateTime(listing.createdAt)}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:min-h-0"
        >
          {showDetails ? 'Hide' : 'View Details'}
        </button>
        <button
          type="button"
          onClick={() => onBuy?.(listing)}
          disabled={buying || isOwnListing || Boolean(disabledLabel)}
          title={isOwnListing ? "You can't act on your own listing" : disabledLabel || undefined}
          className="min-h-[44px] flex-1 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 sm:min-h-0"
        >
          {buying ? 'Working...' : isOwnListing ? 'Your listing' : disabledLabel || actionLabel}
        </button>
      </div>
    </div>
  )
}

export default ListingCard
