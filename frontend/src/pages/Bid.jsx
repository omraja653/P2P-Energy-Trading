import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatKwh, formatDateTime } from '../utils/formatting.js'
import { placeFullDayBid, fetchActiveBids, cancelBid } from '../services/advanced.js'

const AUTO_REFRESH_MS = 10000
// Same grid-retail comparison figure used throughout the backend
// (chat.js/revenueService.js/notificationService.js) — one real number.
const GRID_RATE = 0.15

const TRADING_TYPES = [
  { value: 'intraday', label: '🔥 Intraday (Today)' },
  { value: 'dayahead', label: '📅 Day-Ahead (Tomorrow)' },
]

function Bid() {
  const { user } = useAuth()
  const isProsumer = user?.type === 'prosumer'
  const bidType = isProsumer ? 'sell' : 'buy'

  const [tradingType, setTradingType] = useState('intraday')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [bids, setBids] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    fetchActiveBids()
      .then(setBids)
      .catch(() => setError('Could not load your bids.'))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  async function handlePlaceBid(e) {
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
      setQuantity('')
      setPrice('')
      load()
      if (bid.matched) {
        alert(`Matched! ${formatKwh(bid.executedQuantity)} at ${formatCurrency(bid.executedPrice)}/kWh.`)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not place bid.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id) {
    try {
      await cancelBid(id)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel bid.')
    }
  }

  const estimatedSavings = !isProsumer && price ? (GRID_RATE - Number(price)) * (Number(quantity) || 0) : null

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-4xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">⚡ Trading</h1>
        <p className="mt-1 text-sm text-slate-500">
          You are a <strong className="capitalize">{user?.type}</strong> — bids you place are always{' '}
          <strong>{bidType}</strong> orders. Full-day: no specific hour, matched against any opposing bid the same day.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Place bid */}
          <form onSubmit={handlePlaceBid} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Place Order</h2>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Trading Type</label>
              <div className="flex gap-2">
                {TRADING_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTradingType(t.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      tradingType === t.value ? 'text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                    style={tradingType === t.value ? { backgroundColor: 'rgb(0, 150, 135)', borderColor: 'rgb(0, 150, 135)' } : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Quantity (kWh)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="20"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
              />
            </div>

            <div className="mt-3">
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

            {!isProsumer && (
              <div className="mt-3 rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                Grid rate: {formatCurrency(GRID_RATE)}/kWh.{' '}
                {estimatedSavings != null && quantity && (
                  <>
                    Estimated savings at your bid price: <strong>{formatCurrency(estimatedSavings)}</strong> (actual execution
                    price is the midpoint of your bid and the matched seller's ask, so real savings may differ).
                  </>
                )}
              </div>
            )}

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: 'rgb(76, 175, 80)' }}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? '⏳ Placing…' : '✅ Place Order'}
            </button>
          </form>

          {/* Active bids */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="px-5 pt-5 font-semibold text-slate-900">📊 Active Bids</h2>
            <p className="px-5 pb-2 text-xs text-slate-400">Refreshes every 10s</p>
            {!bids ? (
              <div className="p-5"><LoadingSpinner /></div>
            ) : bids.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No pending bids.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {bids.map((bid) => (
                  <li key={bid._id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-700">
                        {bid.tradingType === 'dayahead' ? '📅' : '🔥'} {formatKwh(bid.bidQuantity)} @ {formatCurrency(bid.bidPrice)}/kWh
                      </p>
                      <p className="text-xs text-slate-400">{formatDateTime(bid.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancel(bid._id)}
                      className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Bid
