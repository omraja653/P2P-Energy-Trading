import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatKwh, formatDateTime } from '../utils/formatting.js'
import { placeBid, fetchSlotsForDate, fetchMySlots } from '../services/advanced.js'

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function SlotTrading() {
  const { user } = useAuth()
  const date = todayDate()
  // Mirrors the backend rule: prosumers can only sell, consumers only buy.
  const bidType = user?.type === 'prosumer' ? 'sell' : 'buy'

  const [allSlots, setAllSlots] = useState([])
  const [mySlots, setMySlots] = useState([])
  const [selectedHour, setSelectedHour] = useState(null)
  const [bidPrice, setBidPrice] = useState('')
  const [bidQuantity, setBidQuantity] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  function load() {
    Promise.all([fetchSlotsForDate(date), fetchMySlots(date)])
      .then(([all, mine]) => {
        setAllSlots(all)
        setMySlots(mine)
      })
      .catch(() => setError('Could not load trading slots.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePlaceBid(e) {
    e.preventDefault()
    setError('')
    if (selectedHour === null || !bidPrice || !bidQuantity) {
      setError('Fill in price and quantity.')
      return
    }
    setSubmitting(true)
    try {
      const slot = await placeBid({
        hour: selectedHour,
        date,
        bidPrice: Number(bidPrice),
        bidQuantity: Number(bidQuantity),
        bidType,
      })
      setBidPrice('')
      setBidQuantity('')
      setSelectedHour(null)
      load()
      if (slot.matched) {
        alert(`Matched! ${formatKwh(slot.executedQuantity)} at ${formatCurrency(slot.executedPrice)}/kWh.`)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not place bid.')
    } finally {
      setSubmitting(false)
    }
  }

  const bidCountByHour = allSlots.reduce((acc, s) => {
    acc[s.hour] = (acc[s.hour] || 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">📊 Intraday Trading Slots</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick an hour today and place a {bidType} bid for that slot — matching {user?.type === 'prosumer' ? 'buy' : 'sell'} bids
          are matched automatically at the midpoint price.
        </p>

        {loading ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {Array.from({ length: 24 }, (_, hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => setSelectedHour(hour)}
                  className={`rounded-lg border p-3 text-center transition ${
                    selectedHour === hour ? 'text-white' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                  style={selectedHour === hour ? { backgroundColor: 'rgb(0, 150, 135)', borderColor: 'rgb(0, 150, 135)' } : undefined}
                >
                  <div className="text-sm font-semibold">{hour}:00</div>
                  <div className={`text-xs ${selectedHour === hour ? 'text-white/80' : 'text-slate-400'}`}>
                    {bidCountByHour[hour] || 0} bids
                  </div>
                </button>
              ))}
            </div>

            {selectedHour !== null && (
              <form onSubmit={handlePlaceBid} className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-900">
                  Place a {bidType} bid for {selectedHour}:00
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Price (₹/kWh)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bidPrice}
                      onChange={(e) => setBidPrice(e.target.value)}
                      placeholder="0.12"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Quantity (kWh)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={bidQuantity}
                      onChange={(e) => setBidQuantity(e.target.value)}
                      placeholder="5"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
                    />
                  </div>
                </div>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ backgroundColor: 'rgb(76, 175, 80)' }}
                  className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Placing…' : 'Place Bid'}
                </button>
              </form>
            )}

            <section className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <h2 className="px-4 pt-4 text-sm font-semibold text-slate-700">My Bids Today</h2>
              {mySlots.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No bids placed yet.</p>
              ) : (
                <table className="mt-2 min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Hour</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Price</th>
                      <th className="px-4 py-2.5">Quantity</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Placed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mySlots.map((s) => (
                      <tr key={s._id}>
                        <td className="px-4 py-2">{s.hour}:00</td>
                        <td className="px-4 py-2 capitalize">{s.bidType}</td>
                        <td className="px-4 py-2">{formatCurrency(s.bidPrice)}</td>
                        <td className="px-4 py-2">{formatKwh(s.bidQuantity)}</td>
                        <td className="px-4 py-2">
                          {s.matched ? (
                            <span className="text-brand-green">✓ Matched ({formatKwh(s.executedQuantity)} @ {formatCurrency(s.executedPrice)})</span>
                          ) : (
                            <span className="text-orange-500">⏳ Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{formatDateTime(s.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default SlotTrading
