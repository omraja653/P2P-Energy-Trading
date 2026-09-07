import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import api from '../services/api.js'
import { fetchWallet } from '../services/dashboard.js'
import { fetchRevenue } from '../services/advanced.js'
import { connectAndJoin, disconnectSocket, getSocket } from '../services/socket.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import AddBalanceModal from '../components/AddBalanceModal.jsx'
import { formatCurrency, formatCurrency3, formatKwh, formatDateTime, truncateHash } from '../utils/formatting.js'

const EXPLORER_TX_URL = 'https://amoy.polygonscan.com/tx/'
const RECENT_COUNT = 10

function personName(person) {
  if (!person || typeof person !== 'object') return 'Unknown'
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown'
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

// Gradient hexes as specified — kept distinct from the app's usual teal
// brand color, since a colored balance card is a different context than a
// button/link and these three colors carry real meaning (green=earned,
// blue=account activity, orange=pending/savings).
function BalanceCard({ icon, label, value, subtext, from, to }) {
  return (
    <div
      className="rounded-xl p-6 text-white shadow-md"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold sm:text-4xl">{value}</p>
      <p className="mt-1 text-sm font-medium text-white/90">{label}</p>
      <p className="mt-0.5 text-xs text-white/70">{subtext}</p>
    </div>
  )
}

function Wallet() {
  const { user } = useAuth()
  const isProsumer = user?.type === 'prosumer'

  const [wallet, setWallet] = useState(null)
  // Read inside the 'wallet-updated' socket handler to decide whether to
  // toast — kept as a ref (not the `wallet` state closure, which would be
  // stale inside an effect that only reruns on [user?.id]) so that check
  // can happen before calling setWallet, not inside its updater (a setState
  // updater must stay a pure function — React can invoke it more than once).
  const walletBalanceRef = useRef(null)
  const [monthRevenue, setMonthRevenue] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())
  const [showAddBalance, setShowAddBalance] = useState(false)

  const [trades, setTrades] = useState({ data: null, loading: true, error: null })
  const [settlements, setSettlements] = useState({ data: null, loading: true, error: null })

  function loadAll() {
    return Promise.all([
      fetchWallet(),
      fetchRevenue(currentMonthKey()),
      api.get('/trades'),
      api.get('/settlements'),
    ]).then(([w, m, tradesRes, settlementsRes]) => {
      setWallet(w)
      setMonthRevenue(m)
      setTrades({ data: tradesRes.data, loading: false, error: null })
      setSettlements({ data: settlementsRes.data, loading: false, error: null })
      return w
    })
  }

  useEffect(() => {
    loadAll().catch(() => {
      setError('Could not load your wallet.')
      setTrades((prev) => ({ ...prev, loading: false }))
      setSettlements((prev) => ({ ...prev, loading: false }))
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    walletBalanceRef.current = wallet?.walletBalance ?? null
  }, [wallet])

  // Real-time: 'order-status-changed' (fires on match and on settlement,
  // targeted at this user — same event Orders listens to) re-fetches the
  // wallet + this month's revenue. 'wallet-updated' (fires when a Razorpay
  // top-up completes) patches walletBalance directly from its payload.
  // Both are backstops, not the only path — see handleTopUpSuccess below,
  // which updates state synchronously from the top-up's own API response
  // rather than depending solely on the socket event arriving.
  useEffect(() => {
    if (!user?.id) return
    connectAndJoin(user.id)
    const socket = getSocket()

    function onOrderStatusChanged() {
      loadAll()
        .then((w) => {
          showToast(`Wallet updated — balance: ${formatCurrency(w.balance)}`)
        })
        .catch(() => {})
    }

    // A Razorpay top-up completed (see routes/wallet.js's verify-topup).
    // handleTopUpSuccess below already applies this same update
    // synchronously from the API response the instant the modal's own
    // request completes, so this is a backstop for other cases (a second
    // open tab, or if that direct update path ever changes) — skip the
    // toast if the balance already matches (i.e. handleTopUpSuccess beat
    // this event here), so a normal top-up doesn't show it twice.
    function onWalletUpdated(payload) {
      const alreadyApplied = walletBalanceRef.current === payload.walletBalance
      setWallet((prev) => (prev ? { ...prev, walletBalance: payload.walletBalance } : prev))
      if (!alreadyApplied) {
        showToast(`✅ ₹${payload.transaction?.amount ?? ''} added to wallet`)
      }
    }

    socket.on('order-status-changed', onOrderStatusChanged)
    socket.on('wallet-updated', onWalletUpdated)
    return () => {
      socket.off('order-status-changed', onOrderStatusChanged)
      socket.off('wallet-updated', onWalletUpdated)
      disconnectSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Applies the new balance synchronously from the top-up's own API
  // response (verify-topup already returns `newBalance` — see
  // routes/wallet.js) rather than waiting on the 'wallet-updated' socket
  // event to arrive. That event still fires and still patches state (the
  // handler above), which matters for e.g. a second open tab — but this
  // page's own update no longer depends on it: if the socket was ever
  // disconnected, delayed, or dropped a message, the balance used to only
  // catch up on a manual refresh. onWalletUpdated's ref check keeps this
  // from double-toasting once that event does arrive.
  function handleTopUpSuccess(result) {
    setShowAddBalance(false)
    if (typeof result?.newBalance === 'number') {
      setWallet((prev) => (prev ? { ...prev, walletBalance: result.newBalance } : prev))
      showToast('✅ Balance added to wallet')
    }
  }

  function showToast(message) {
    setToast(message)
  }

  function toggleRow(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const transactions = useMemo(() => {
    return (trades.data || [])
      .map((t) => {
        const buyerId = t.buyerId?._id || t.buyerId
        const isBought = buyerId === user?.id
        return {
          ...t,
          direction: isBought ? 'Bought' : 'Sold',
          counterpartyName: personName(isBought ? t.sellerId : t.buyerId),
          settlement: (settlements.data || []).find((s) => (s.tradeId?._id || s.tradeId) === t._id),
        }
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [trades.data, settlements.data, user?.id])

  const recentTransactions = transactions.slice(0, RECENT_COUNT)
  const tradesLoading = trades.loading || settlements.loading

  // Quick Stats reflects "This Month" — the same real aggregation
  // GET /api/revenue/:month already computes (energy traded, average
  // price, totals, pending/savings). A "This Week" option was in the
  // pasted spec, but there's no weekly-aggregation endpoint, and
  // recomputing that formula client-side would risk drifting from the
  // backend's real math (fees, realized-status rules) — left out rather
  // than duplicated, flagged here instead of silently added.
  const avgPrice = monthRevenue && monthRevenue.totalUnits > 0
    ? (isProsumer ? monthRevenue.totalEarnings : monthRevenue.totalSpent) / monthRevenue.totalUnits
    : 0

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-5xl p-3 sm:p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">💰 Wallet</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" /> Live
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Trade earnings/savings below are lifetime totals from your real trades, read-only — there's still no
          payout/withdrawal flow (Razorpay can't disburse money to you, only collect it; see the note on the Add
          Balance button). Your wallet balance is real money added via Razorpay test payments.
        </p>

        {error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : !wallet ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : (
          <>
            {/* Real, stored top-up balance (Razorpay) — distinct from the
                trade-derived cards below. Nothing in the purchase flow
                spends this yet (flagged in routes/wallet.js and repeated
                here) — it's a real, persisted number, just not wired into
                buying energy. */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-sm font-medium text-slate-500">Wallet Balance</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{formatCurrency(wallet.walletBalance)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBalance(true)}
                style={{ backgroundColor: 'rgb(0, 150, 135)' }}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                + Add Balance
              </button>
            </div>

            {/* Balance cards. Deviation flagged: the pasted spec's consumer
                Card 1 is "Account Balance" ("Available to spend") — this
                app has no funded/topped-up wallet balance (no deposit
                system exists), so that number would be fabricated. Shown
                instead as "Total Savings" (lifetime), the real number this
                app actually tracks for a consumer. Same reasoning drops
                "Available Balance" for a prosumer (no separate
                available-vs-total ledger exists) in favor of "This
                Month's Earnings", a real distinct figure. */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {isProsumer ? (
                <>
                  <BalanceCard
                    icon="💰"
                    label="Total Earnings"
                    value={formatCurrency(wallet.balance)}
                    subtext="Lifetime, updated on every trade"
                    from="#4CAF50" to="#45a049"
                  />
                  <BalanceCard
                    icon="📊"
                    label="This Month's Earnings"
                    value={formatCurrency(monthRevenue?.totalEarnings ?? 0)}
                    subtext="Since the 1st of this month"
                    from="#2196F3" to="#1976D2"
                  />
                  <BalanceCard
                    icon="⏳"
                    label="Pending"
                    value={formatCurrency(wallet.pending)}
                    subtext="Matched, not yet meter-verified"
                    from="#FF9800" to="#F57C00"
                  />
                </>
              ) : (
                <>
                  <BalanceCard
                    icon="🌱"
                    label="Total Savings"
                    value={formatCurrency(wallet.balance)}
                    subtext="Lifetime, vs grid retail rate"
                    from="#4CAF50" to="#45a049"
                  />
                  <BalanceCard
                    icon="💳"
                    label="Total Spent"
                    value={formatCurrency(wallet.totalSpent)}
                    subtext="Lifetime"
                    from="#2196F3" to="#1976D2"
                  />
                  <BalanceCard
                    icon="🌱"
                    label="This Month's Savings"
                    value={formatCurrency(monthRevenue?.totalEarnings ?? 0)}
                    subtext="Since the 1st of this month"
                    from="#FF9800" to="#F57C00"
                  />
                </>
              )}
            </div>

            {/* Quick Stats — this month */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">This Month</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-400">{isProsumer ? 'Energy Sold' : 'Energy Bought'}</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-800">{formatKwh(monthRevenue?.totalUnits ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Average Price</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-800">{formatCurrency3(avgPrice)}/kWh</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{isProsumer ? 'Total Earnings' : 'Total Spent'}</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-800">
                    {formatCurrency(isProsumer ? monthRevenue?.totalEarnings ?? 0 : monthRevenue?.totalSpent ?? 0)}
                  </p>
                </div>
                {isProsumer ? (
                  <div>
                    <p className="text-xs text-slate-400">Pending Payment</p>
                    <p className="mt-0.5 text-lg font-semibold text-orange-600">{formatCurrency(monthRevenue?.pending ?? 0)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-400">Savings vs Grid</p>
                    <p className="mt-0.5 text-lg font-semibold text-green-600">{formatCurrency(monthRevenue?.totalEarnings ?? 0)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transaction history — last 10, real Trade + Settlement data
                (same source TradeHistory/Orders uses). "View All" links to
                the Orders page rather than re-implementing pagination and
                filtering here a second time. */}
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
                <Link
                  to="/trade-history"
                  className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:min-h-0"
                >
                  View All Transactions →
                </Link>
              </div>

              <div className="mt-3">
                {tradesLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm"><LoadingSpinner /></div>
                ) : recentTransactions.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
                    No transactions yet.
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-2.5">Date</th>
                            <th className="px-4 py-2.5">Type</th>
                            <th className="px-4 py-2.5">Quantity</th>
                            <th className="px-4 py-2.5">Price</th>
                            <th className="px-4 py-2.5">Total</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentTransactions.map((t) => (
                            <Fragment key={t._id}>
                              <tr className="cursor-pointer transition hover:bg-slate-50" onClick={() => toggleRow(t._id)}>
                                <td className="px-4 py-2.5 text-slate-500">{formatDateTime(t.createdAt)}</td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                      t.direction === 'Bought' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                    }`}
                                  >
                                    {t.direction === 'Bought' ? 'BOUGHT' : 'SOLD'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">{formatKwh(t.quantityKWh)}</td>
                                <td className="px-4 py-2.5">{formatCurrency(t.pricePerKwh)}</td>
                                <td className="px-4 py-2.5 font-medium text-slate-800">{formatCurrency(t.totalAmount)}</td>
                                <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                              </tr>
                              {expanded.has(t._id) && (
                                <tr className="bg-slate-50">
                                  <td colSpan={6} className="px-4 py-3 text-xs text-slate-600">
                                    <p>Counterparty: {t.counterpartyName}</p>
                                    {t.settlement ? (
                                      <>
                                        <p className="mt-1">Settled: {formatDateTime(t.settlement.createdAt)}</p>
                                        {t.settlement.blockchainTxHash && (
                                          <a
                                            href={`${EXPLORER_TX_URL}${t.settlement.blockchainTxHash}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-1 block text-brand-blue hover:underline"
                                          >
                                            Blockchain tx: {truncateHash(t.settlement.blockchainTxHash)}
                                          </a>
                                        )}
                                      </>
                                    ) : (
                                      <p className="mt-1 text-slate-500">Not yet settled.</p>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile card list */}
                    <ul className="grid grid-cols-1 gap-3 md:hidden">
                      {recentTransactions.map((t) => (
                        <li key={t._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                t.direction === 'Bought' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {t.direction === 'Bought' ? 'BOUGHT' : 'SOLD'}
                            </span>
                            <StatusBadge status={t.status} />
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-900">
                            {formatKwh(t.quantityKWh)} @ {formatCurrency(t.pricePerKwh)}/kWh
                          </p>
                          <p className="mt-1 text-sm text-slate-500">Total: {formatCurrency(t.totalAmount)}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatDateTime(t.createdAt)}</p>

                          {expanded.has(t._id) && (
                            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                              <p>Counterparty: {t.counterpartyName}</p>
                              {t.settlement ? (
                                <>
                                  <p className="mt-1">Settled: {formatDateTime(t.settlement.createdAt)}</p>
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
                                </>
                              ) : (
                                <p className="mt-1 text-slate-500">Not yet settled.</p>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleRow(t._id)}
                            className="mt-3 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            {expanded.has(t._id) ? 'Hide details' : 'View details'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      {showAddBalance && (
        <AddBalanceModal onClose={() => setShowAddBalance(false)} onSuccess={handleTopUpSuccess} />
      )}
    </div>
  )
}

export default Wallet
