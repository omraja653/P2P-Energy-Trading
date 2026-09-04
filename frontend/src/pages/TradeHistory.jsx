import { Fragment, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import api from '../services/api.js'
import { fetchActiveBids, cancelBid as cancelPendingBid } from '../services/advanced.js'
import { connectAndJoin, disconnectSocket, getSocket } from '../services/socket.js'
import StatusBadge from '../components/StatusBadge.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatCurrency3, formatKwh, formatDateTime, truncateHash } from '../utils/formatting.js'

// "Orders" = every pending TradingSlot bid a user has placed (via
// Marketplace's Create Bid or the /bid page) PLUS every real Trade they're
// party to (matched onward). Two real data sources merged into one list —
// not a fabricated single "orders" collection, since this app doesn't have
// one; see combinedRows below.
const TYPE_FILTERS = ['All', 'Bought', 'Sold']
// Real statuses only. 'pending' = still an unmatched TradingSlot bid, not
// yet a Trade. 'verified' has no live code path that ever sets it (kept as
// a pre-existing filter option regardless — not this task's scope to prune).
const STATUS_FILTERS = ['All', 'pending', 'matched', 'verified', 'settled', 'cancelled']

const EXPLORER_TX_URL = 'https://amoy.polygonscan.com/tx/'

function personName(person) {
  if (!person || typeof person !== 'object') return 'Unknown'
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown'
}

function escapeCsvField(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function exportToCsv(rows) {
  const headers = ['Date', 'Type', 'Prosumer', 'Energy (kWh)', 'Price (₹/kWh)', 'Amount (₹)', 'Status', 'Blockchain Tx']
  const lines = rows.map((t) =>
    [
      formatDateTime(t.createdAt),
      t.direction,
      t.counterpartyName,
      t.quantityKWh,
      t.pricePerKwh,
      t.totalAmount,
      t.status,
      t.settlement?.blockchainTxHash || '',
    ]
      .map(escapeCsvField)
      .join(',')
  )
  const csv = [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gridmate-trade-history-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function SearchFilterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />
    </svg>
  )
}

function TradeHistory() {
  const { user } = useAuth()
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [cancellingId, setCancellingId] = useState(null)
  const [toast, setToast] = useState(null)

  // Fetched into local state (not useFetch) so live socket events can
  // mutate a trade's status/blockchain hash in place instead of the page
  // needing to refetch on every update.
  const [trades, setTrades] = useState({ data: null, loading: true, error: null })
  const [settlements, setSettlements] = useState({ data: null, loading: true, error: null })
  const [pendingBids, setPendingBids] = useState({ data: null, loading: true, error: null })

  function showToast(message) {
    setToast(message)
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  function loadTradesAndSettlements() {
    return Promise.all([api.get('/trades'), api.get('/settlements')]).then(([tradesRes, settlementsRes]) => {
      setTrades({ data: tradesRes.data, loading: false, error: null })
      setSettlements({ data: settlementsRes.data, loading: false, error: null })
    })
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([loadTradesAndSettlements(), fetchActiveBids().then((data) => !cancelled && setPendingBids({ data, loading: false, error: null }))]).catch(
      (err) => {
        if (cancelled) return
        setTrades((prev) => ({ ...prev, loading: false, error: err }))
        setSettlements((prev) => ({ ...prev, loading: false, error: err }))
        setPendingBids((prev) => ({ ...prev, loading: false, error: err }))
      }
    )
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live updates — real transition points only (see slotMatchingService.js/
  // routes/trades.js/routes/settlements.js on the backend), no fabricated
  // "executed" step:
  //  - new-bid / bid-matched / bid-cancelled: broadcast to everyone, so
  //    they're filtered here to just this user's own pending bids.
  //  - order-status-changed / order-cancelled: targeted at this user
  //    already (join'd below), so no filtering needed.
  useEffect(() => {
    if (!user?.id) return
    connectAndJoin(user.id)
    const socket = getSocket()

    function onOrderStatusChanged(payload) {
      let found = true
      setTrades((prev) => {
        if (!prev.data) return prev
        const idx = prev.data.findIndex((t) => t._id === payload.orderId)
        if (idx === -1) {
          found = false
          return prev
        }
        const next = [...prev.data]
        next[idx] = {
          ...next[idx],
          status: payload.newStatus || next[idx].status,
          blockchainTxHash: payload.blockchainHash ?? next[idx].blockchainTxHash,
        }
        return { ...prev, data: next }
      })
      // A brand-new trade (this user's bid just matched, via the other
      // party's action) isn't in `trades.data` yet — the patch above is a
      // no-op for it, so re-fetch instead of silently missing it. Also
      // covers the fee-breakdown/blockchain-hash refresh for an existing
      // trade's settlement, same as before.
      if (!found) {
        loadTradesAndSettlements().catch(() => {})
      } else {
        api.get('/settlements').then((res) => setSettlements((prev) => ({ ...prev, data: res.data }))).catch(() => {})
      }
      showToast(`Order status changed to ${payload.newStatus}`)
    }

    function onOrderCancelled({ orderId }) {
      setTrades((prev) => {
        if (!prev.data) return prev
        return { ...prev, data: prev.data.filter((t) => t._id !== orderId) }
      })
      showToast('Order cancelled')
    }

    // Broadcasts — every connected client gets these, so only act when the
    // bid id belongs to this user's own pending list.
    function onBidMatched({ bidIds }) {
      setPendingBids((prev) => {
        if (!prev.data) return prev
        const mine = prev.data.some((b) => bidIds.includes(b._id))
        if (!mine) return prev
        return { ...prev, data: prev.data.filter((b) => !bidIds.includes(b._id)) }
      })
    }

    function onBidCancelled({ bidId }) {
      setPendingBids((prev) => {
        if (!prev.data) return prev
        return { ...prev, data: prev.data.filter((b) => b._id !== bidId) }
      })
    }

    socket.on('order-status-changed', onOrderStatusChanged)
    socket.on('order-cancelled', onOrderCancelled)
    socket.on('bid-matched', onBidMatched)
    socket.on('bid-cancelled', onBidCancelled)

    return () => {
      socket.off('order-status-changed', onOrderStatusChanged)
      socket.off('order-cancelled', onOrderCancelled)
      socket.off('bid-matched', onBidMatched)
      socket.off('bid-cancelled', onBidCancelled)
      disconnectSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const rows = useMemo(() => {
    const tradeRows = (trades.data || []).map((t) => {
      const buyerId = t.buyerId?._id || t.buyerId
      const isBought = buyerId === user?.id
      return {
        _id: t._id,
        isPendingBid: false,
        direction: isBought ? 'Bought' : 'Sold',
        counterpartyName: personName(isBought ? t.sellerId : t.buyerId),
        quantityKWh: t.quantityKWh,
        pricePerKwh: t.pricePerKwh,
        totalAmount: t.totalAmount,
        status: t.status,
        createdAt: t.createdAt,
        settlement: (settlements.data || []).find((s) => (s.tradeId?._id || s.tradeId) === t._id),
      }
    })

    // A still-pending bid has no counterparty yet (that's the point of
    // "pending" — nobody's matched it) and no settlement, so those fields
    // are honestly left blank/dash rather than invented.
    const pendingRows = (pendingBids.data || []).map((b) => ({
      _id: b._id,
      isPendingBid: true,
      direction: b.bidType === 'sell' ? 'Sold' : 'Bought',
      counterpartyName: '—',
      quantityKWh: b.bidQuantity,
      pricePerKwh: b.bidPrice,
      totalAmount: Number((b.bidQuantity * b.bidPrice).toFixed(4)),
      status: 'pending',
      createdAt: b.createdAt,
      settlement: null,
    }))

    return [...pendingRows, ...tradeRows]
      .filter((t) => typeFilter === 'All' || t.direction === typeFilter)
      .filter((t) => statusFilter === 'All' || t.status === statusFilter)
      .filter((t) => !dateFrom || new Date(t.createdAt) >= new Date(dateFrom))
      .filter((t) => !dateTo || new Date(t.createdAt) <= new Date(`${dateTo}T23:59:59`))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [trades.data, settlements.data, pendingBids.data, user?.id, typeFilter, statusFilter, dateFrom, dateTo])

  function toggleRow(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCancel(id) {
    if (!window.confirm('Are you sure you want to cancel this bid?')) return
    setCancellingId(id)
    try {
      await cancelPendingBid(id)
      setPendingBids((prev) => ({ ...prev, data: (prev.data || []).filter((b) => b._id !== id) }))
      showToast('✅ Bid cancelled')
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not cancel this bid')
    } finally {
      setCancellingId(null)
    }
  }

  const loading = trades.loading || settlements.loading || pendingBids.loading
  const error = trades.error || settlements.error || pendingBids.error

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl p-3 sm:p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Orders &amp; Transactions</h1>
            <p className="text-sm text-slate-500">{rows.length} order{rows.length === 1 ? '' : 's'}</p>
          </div>
          <button
            type="button"
            onClick={() => exportToCsv(rows)}
            disabled={rows.length === 0}
            className="min-h-[44px] rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 sm:min-h-0"
          >
            ⭳ Export to CSV
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border-t-4 border-teal bg-white p-4 shadow-sm">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  typeFilter === f ? 'bg-teal text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`rounded px-3 py-1 text-sm font-medium capitalize transition ${
                  statusFilter === f ? 'bg-teal text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {/* Orders */}
        <div className="mt-6">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm"><LoadingSpinner /></div>
          ) : error ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-red-600 shadow-sm">Failed to load your orders.</p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
              <SearchFilterIcon className="mx-auto h-8 w-8" />
              <p className="mt-2 text-sm text-slate-500">No orders match these filters.</p>
            </div>
          ) : (
            <>
              {/* Desktop/tablet: full table (horizontal scroll on narrower
                  widths, e.g. tablet, rather than dropping columns). Hidden
                  below md — the card list underneath takes over there. */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">ID</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Prosumer</th>
                      <th className="px-4 py-2.5">Quantity</th>
                      <th className="px-4 py-2.5">Price</th>
                      <th className="px-4 py-2.5">Total</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((t) => (
                      <Fragment key={t._id}>
                        <tr className="cursor-pointer transition hover:bg-slate-50" onClick={() => toggleRow(t._id)}>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{String(t._id).slice(-6)}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                t.direction === 'Sold' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {t.direction === 'Sold' ? 'SELL' : 'BUY'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{t.counterpartyName}</td>
                          <td className="px-4 py-2.5">{formatKwh(t.quantityKWh)}</td>
                          <td className="px-4 py-2.5">{formatCurrency(t.pricePerKwh)}</td>
                          <td className="px-4 py-2.5">{formatCurrency(t.totalAmount)}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                          <td className="px-4 py-2.5 text-slate-500">{formatDateTime(t.createdAt)}</td>
                          <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                            {t.isPendingBid ? (
                              <button
                                type="button"
                                onClick={() => handleCancel(t._id)}
                                disabled={cancellingId === t._id}
                                className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {cancellingId === t._id ? 'Cancelling…' : 'Cancel'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleRow(t._id)}
                                className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                {expanded.has(t._id) ? 'Hide' : 'View'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded.has(t._id) && (
                          <tr className="bg-slate-50">
                            <td colSpan={9} className="px-4 py-3">
                              {t.isPendingBid ? (
                                <p className="text-xs text-slate-500">Still pending — not yet matched with a counterparty.</p>
                              ) : t.settlement ? (
                                <div className="grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                                  <p>{t.direction === 'Bought' ? 'You paid' : 'Trade total'}: {formatCurrency(t.totalAmount)}</p>
                                  <p>Matched with: {t.counterpartyName}</p>
                                  <p>Prosumer earned: {formatCurrency3(t.settlement.prosumerAmount)}</p>
                                  <p>Grid wheeling fee: {formatCurrency3(t.settlement.gridWheelAmount)}</p>
                                  <p>Platform fee: {formatCurrency3(t.settlement.platformAmount)}</p>
                                  {t.settlement.blockchainTxHash && (
                                    <a
                                      href={`${EXPLORER_TX_URL}${t.settlement.blockchainTxHash}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-brand-blue hover:underline"
                                    >
                                      Blockchain tx: {truncateHash(t.settlement.blockchainTxHash)}
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">
                                  Matched with {t.counterpartyName}.{' '}
                                  {t.status === 'settled' ? 'Settlement record not found.' : 'Settlement pending — awaiting verification and T+1 settlement.'}
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: card list instead of a table. Shows type/quantity/
                  price/total/status up front; date and the settlement fee
                  breakdown/blockchain link sit behind "View" (tap to
                  expand) — same real data as the desktop expanded row, no
                  fabricated fields. A pending bid gets a real Cancel button
                  (it's an actual TradingSlot that can be cancelled); a
                  matched/settled Trade gets "View details" instead, since
                  there's no real "cancel a matched Trade" capability in
                  this app to attach a Cancel button to. */}
              <ul className="grid grid-cols-1 gap-3 md:hidden">
                {rows.map((t) => (
                  <li key={t._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          t.direction === 'Sold' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {t.direction === 'Sold' ? 'SELL' : 'BUY'}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {formatKwh(t.quantityKWh)} @ {formatCurrency(t.pricePerKwh)}/kWh
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Total: {formatCurrency(t.totalAmount)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {t.isPendingBid ? formatDateTime(t.createdAt) : `with ${t.counterpartyName}`}
                    </p>

                    {expanded.has(t._id) && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <p>Date: {formatDateTime(t.createdAt)}</p>
                        {t.isPendingBid ? (
                          <p className="mt-1 text-slate-500">Still pending — not yet matched with a counterparty.</p>
                        ) : t.settlement ? (
                          <div className="mt-1 space-y-0.5">
                            <p>Matched with: {t.counterpartyName}</p>
                            <p>Prosumer earned: {formatCurrency3(t.settlement.prosumerAmount)}</p>
                            <p>Grid wheeling fee: {formatCurrency3(t.settlement.gridWheelAmount)}</p>
                            <p>Platform fee: {formatCurrency3(t.settlement.platformAmount)}</p>
                            {t.settlement.blockchainTxHash && (
                              <a
                                href={`${EXPLORER_TX_URL}${t.settlement.blockchainTxHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 block text-brand-blue hover:underline"
                              >
                                {truncateHash(t.settlement.blockchainTxHash)}
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-slate-500">
                            Matched with {t.counterpartyName}. {t.status === 'settled' ? 'Settlement record not found.' : 'Settlement pending.'}
                          </p>
                        )}
                      </div>
                    )}

                    {t.isPendingBid ? (
                      <button
                        type="button"
                        onClick={() => handleCancel(t._id)}
                        disabled={cancellingId === t._id}
                        className="mt-3 min-h-[44px] w-full rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancellingId === t._id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleRow(t._id)}
                        className="mt-3 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {expanded.has(t._id) ? 'Hide details' : 'View details'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Toast — bottom-right, auto-dismisses after 3s (see the useEffect
          above); used for cancel results and live order-status-changed
          pushes. */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

export default TradeHistory
