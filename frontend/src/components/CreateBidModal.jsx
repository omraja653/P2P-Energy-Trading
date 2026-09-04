import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { formatCurrency, formatKwh } from '../utils/formatting.js'
import { placeFullDayBid } from '../services/advanced.js'

// Same grid-retail comparison figure used throughout the backend
// (chat.js/revenueService.js/notificationService.js) — one real number.
const GRID_RATE = 0.15

const TRADING_TYPES = [
  { value: 'intraday', label: '🔥 Intraday (Today)' },
  { value: 'dayahead', label: '📅 Day-Ahead (Tomorrow)' },
]

// Reuses the exact same bid-placement + auto-match + notification pipeline
// as Bid.jsx/SlotTrading.jsx (services/advanced.js -> POST /api/slots/bid ->
// slotMatchingService) — no new backend, no second matching engine.
function CreateBidModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const isProsumer = user?.type === 'prosumer'
  const bidType = isProsumer ? 'sell' : 'buy' // auto-selected by role, not user-editable

  const [tradingType, setTradingType] = useState('intraday')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const estimatedSavings = !isProsumer && price && quantity ? (GRID_RATE - Number(price)) * Number(quantity) : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!quantity || !price) {
      setError('Fill in quantity and price.')
      return
    }
    setSubmitting(true)
    try {
      const bid = await placeFullDayBid({
        tradingType,
        bidQuantity: Number(quantity),
        bidPrice: Number(price),
        bidType,
      })
      onCreated(bid)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not place bid.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-2.5 sm:px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Create Bid</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          You're placing a <strong className="uppercase">{bidType}</strong> bid ({isProsumer ? 'prosumer' : 'consumer'}{' '}
          accounts can only trade this direction).
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Trading Type</label>
            <div className="flex gap-2">
              {TRADING_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTradingType(t.value)}
                  className={`min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition sm:min-h-0 ${
                    tradingType === t.value ? 'text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                  style={tradingType === t.value ? { backgroundColor: 'rgb(0, 150, 135)', borderColor: 'rgb(0, 150, 135)' } : undefined}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Quantity (kWh)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="20"
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Price (₹/kWh)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.12"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
            />
          </div>

          {!isProsumer && estimatedSavings != null && (
            <div className="rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
              Grid rate: {formatCurrency(GRID_RATE)}/kWh. Estimated savings at your bid price:{' '}
              <strong>{formatCurrency(estimatedSavings)}</strong> (actual execution price is the midpoint of your bid
              and the matched seller's ask).
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:min-h-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: 'rgb(76, 175, 80)' }}
              className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 sm:min-h-0"
            >
              {submitting ? 'Placing…' : 'Place Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateBidModal
