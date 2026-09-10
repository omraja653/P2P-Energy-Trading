import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatKwh, formatDateTime } from '../utils/formatting.js'
import { getSocket } from '../services/socket.js'
import {
  placeAuctionOrder,
  fetchAuctionBook,
  fetchMyAuctionOrders,
  cancelAuctionOrder,
  fetchMyAuctionMatches,
} from '../services/auction.js'

const REFRESH_MS = 5000

function Countdown({ targetMs }) {
  const [remaining, setRemaining] = useState(targetMs)
  useEffect(() => {
    setRemaining(targetMs)
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000)
    return () => clearInterval(id)
  }, [targetMs])
  const s = Math.ceil(remaining / 1000)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return <span className="font-mono tabular-nums">{mm}:{ss}</span>
}

function AuctionMarket() {
  const { user } = useAuth()
  const isProsumer = user?.type === 'prosumer'
  const side = isProsumer ? 'SELL' : 'BUY'

  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [book, setBook] = useState(null)
  const [myOrders, setMyOrders] = useState(null)
  const [matches, setMatches] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const nextRoundMsRef = useRef(0)
  const [nextRoundMs, setNextRoundMs] = useState(0)

  const load = useCallback(() => {
    fetchAuctionBook()
      .then((b) => {
        setBook(b)
        nextRoundMsRef.current = b.nextRoundInMs
        setNextRoundMs(b.nextRoundInMs)
      })
      .catch(() => setError('Could not load the auction book.'))
    fetchMyAuctionOrders().then(setMyOrders).catch(() => {})
    fetchMyAuctionMatches().then(setMatches).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_MS)
    const socket = getSocket()
    socket.connect()
    const onAuctionCompleted = (summary) => {
      if (summary.cleared) {
        setNotice(
          `Round ${summary.round} cleared: ${summary.clearingQuantity} kWh at ${formatCurrency(summary.clearingPrice)}/kWh`
        )
      }
      load()
    }
    socket.on('auction-completed', onAuctionCompleted)
    return () => {
      clearInterval(interval)
      socket.off('auction-completed', onAuctionCompleted)
    }
  }, [load])

  async function handlePlace(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!quantity || !price) {
      setError('Fill in quantity and price.')
      return
    }
    setSubmitting(true)
    try {
      const res = await placeAuctionOrder({ side, quantity: Number(quantity), pricePerKwh: Number(price) })
      setQuantity('')
      setPrice('')
      setNotice(`Order submitted. Next round closes in ${Math.ceil((res.nextRoundInMs || 0) / 1000)}s.`)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not place order.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id) {
    try {
      await cancelAuctionOrder(id)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel order.')
    }
  }

  const pendingMine = (myOrders || []).filter((o) => o.status === 'pending')

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">⚡ Marketplace</h1>
        <p className="mt-1 text-sm text-slate-500">
          Place a buy or sell order. Every couple of minutes the market clears and{' '}
          <strong>everyone trades at one fair price</strong> set by supply and demand. You are a{' '}
          <strong className="capitalize">{user?.type}</strong>, so your orders are always <strong>{side}</strong>.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          ⏰ Next round closes in <Countdown targetMs={nextRoundMs} /> — you can add or cancel orders until then.
        </div>

        {notice && (
          <div className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{notice}</div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Place order */}
          <form onSubmit={handlePlace} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Place {side} Order</h2>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Quantity (kWh)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {side === 'BUY' ? 'Max price you will pay' : 'Min price you will accept'} (₹/kWh)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="4.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
              />
            </div>

            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              The clearing price is set by the whole round's supply and demand — it can be better than your limit,
              never worse. If it settles worse than your limit, your order simply doesn't trade this round.
            </p>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: 'rgb(76, 175, 80)' }}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? '⏳ Submitting…' : `✅ Submit ${side} Order`}
            </button>
          </form>

          {/* Order book depth (anonymised) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">📊 This Round</h2>
            {!book ? (
              <div className="pt-3"><LoadingSpinner /></div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Demand</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{formatKwh(book.buy.totalQuantity)}</p>
                  <p className="text-xs text-slate-400">{book.buy.count} buy order(s)</p>
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                    {book.buy.ladder.map((l) => (
                      <li key={`b${l.price}`}>{formatKwh(l.quantity)} @ ≤{formatCurrency(l.price)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Supply</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{formatKwh(book.sell.totalQuantity)}</p>
                  <p className="text-xs text-slate-400">{book.sell.count} sell order(s)</p>
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                    {book.sell.ladder.map((l) => (
                      <li key={`s${l.price}`}>{formatKwh(l.quantity)} @ ≥{formatCurrency(l.price)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* My pending orders */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="px-5 pt-5 font-semibold text-slate-900">Your Pending Orders</h2>
          {!myOrders ? (
            <div className="p-5"><LoadingSpinner /></div>
          ) : pendingMine.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No orders waiting for the next round.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingMine.map((o) => (
                <li key={o._id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-700">
                      {o.side} {formatKwh(o.quantity)} @ {o.side === 'BUY' ? '≤' : '≥'}{formatCurrency(o.pricePerKwh)}/kWh
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(o.createdAt)}
                      {o.filledQuantity > 0 && ` · ${formatKwh(o.filledQuantity)} filled so far`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancel(o._id)}
                    className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* My auction trades */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="px-5 pt-5 font-semibold text-slate-900">Your Auction Trades</h2>
          {!matches ? (
            <div className="p-5"><LoadingSpinner /></div>
          ) : matches.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No auction trades yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Round</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Volume</th>
                    <th className="px-4 py-2">Clearing Price</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Blockchain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matches.map((t) => {
                    const asSeller = String(t.sellerId?._id || t.sellerId) === String(user?.id)
                    return (
                      <tr key={t._id}>
                        <td className="px-4 py-2">#{t.auctionRound}</td>
                        <td className="px-4 py-2">{asSeller ? 'Seller' : 'Buyer'}</td>
                        <td className="px-4 py-2">{formatKwh(t.quantityKWh)}</td>
                        <td className="px-4 py-2">{formatCurrency(t.clearingPrice ?? t.pricePerKwh)}/kWh</td>
                        <td className="px-4 py-2">{formatCurrency(t.totalAmount)}</td>
                        <td className="px-4 py-2 capitalize">
                          {t.status === 'matched' ? 'Awaiting settlement' : t.status}
                        </td>
                        <td className="px-4 py-2">
                          {t.blockchainTxHash ? (
                            <a
                              href={`https://amoy.polygonscan.com/tx/${t.blockchainTxHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-600 underline"
                            >
                              {t.blockchainTxHash.slice(0, 10)}…
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuctionMarket
