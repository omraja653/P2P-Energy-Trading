import { useState } from 'react'
import { formatCurrency, formatKwh } from '../utils/formatting.js'

const TRADING_TYPE_LABELS = {
  intraday: 'Intraday',
  dayahead: 'Day-Ahead',
}

function ListingCard({ listing, currentUserId, onBuy, buying }) {
  const [showDetails, setShowDetails] = useState(false)

  const prosumerName = listing.prosumerId
    ? `${listing.prosumerId.firstName} ${listing.prosumerId.lastName}`
    : 'Unknown'
  const isOwnListing = listing.prosumerId?._id === currentUserId

  return (
    <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-lg">
      <div>
        <p className="text-sm text-slate-500">Prosumer: <span className="font-medium text-slate-700">{prosumerName}</span></p>
        <p className="mt-2 text-lg font-semibold text-slate-900">{formatKwh(listing.quantityKWh)}</p>
        <p className="text-sm text-slate-600">{formatCurrency(listing.pricePerKwh)}/kWh</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-blue-600">
          {TRADING_TYPE_LABELS[listing.tradingType] || listing.tradingType}
        </p>

        {showDetails && (
          <div className="mt-3 rounded bg-slate-50 p-3 text-xs text-slate-500">
            <p>Listing ID: {listing._id}</p>
            <p>Total: {formatCurrency(listing.quantityKWh * listing.pricePerKwh)}</p>
            <p>Listed: {new Date(listing.createdAt).toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {showDetails ? 'Hide' : 'View Details'}
        </button>
        <button
          type="button"
          onClick={() => onBuy?.(listing)}
          disabled={buying || isOwnListing}
          title={isOwnListing ? "You can't buy your own listing" : undefined}
          className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {buying ? 'Buying...' : isOwnListing ? 'Your listing' : `Buy ${formatKwh(listing.quantityKWh)}`}
        </button>
      </div>
    </div>
  )
}

export default ListingCard
