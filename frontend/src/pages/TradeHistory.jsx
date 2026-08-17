import { Fragment, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import StatusBadge from '../components/StatusBadge.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatCurrency3, formatKwh, formatDateTime, truncateHash } from '../utils/formatting.js'

const TYPE_FILTERS = ['All', 'Bought', 'Sold']
// Real statuses only — this app has no "disputed" trade state (no dispute
// model/flow exists), so it isn't offered as a filter or badge here.
const STATUS_FILTERS = ['All', 'matched', 'verified', 'settled', 'cancelled']

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
  const headers = ['Date', 'Type', 'Prosumer', 'Energy (kWh)', 'Price ($/kWh)', 'Amount ($)', 'Status', 'Blockchain Tx']
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

  const trades = useFetch('/trades')
  const settlements = useFetch('/settlements')

  const rows = useMemo(() => {
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
      .filter((t) => typeFilter === 'All' || t.direction === typeFilter)
      .filter((t) => statusFilter === 'All' || t.status === statusFilter)
      .filter((t) => !dateFrom || new Date(t.createdAt) >= new Date(dateFrom))
      .filter((t) => !dateTo || new Date(t.createdAt) <= new Date(`${dateTo}T23:59:59`))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [trades.data, settlements.data, user?.id, typeFilter, statusFilter, dateFrom, dateTo])

  function toggleRow(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const loading = trades.loading || settlements.loading
  const error = trades.error || settlements.error

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Trade History &amp; Settlements</h1>
          <button
            type="button"
            onClick={() => exportToCsv(rows)}
            disabled={rows.length === 0}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
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

        {/* Trades */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <p className="p-4 text-red-600">Failed to load trade history.</p>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <SearchFilterIcon className="mx-auto h-8 w-8" />
              <p className="mt-2 text-sm text-slate-500">No trades match these filters.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Prosumer</th>
                  <th className="px-4 py-2.5">Energy (kWh)</th>
                  <th className="px-4 py-2.5">Price</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Blockchain</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <Fragment key={t._id}>
                    <tr className="cursor-pointer transition hover:bg-slate-50" onClick={() => toggleRow(t._id)}>
                      <td className="px-4 py-2.5 text-slate-500">{formatDateTime(t.createdAt)}</td>
                      <td className="px-4 py-2.5">{t.direction}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{t.counterpartyName}</td>
                      <td className="px-4 py-2.5">{formatKwh(t.quantityKWh)}</td>
                      <td className="px-4 py-2.5">{formatCurrency(t.pricePerKwh)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-2.5">
                        {t.settlement?.blockchainTxHash ? (
                          <a
                            href={`${EXPLORER_TX_URL}${t.settlement.blockchainTxHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-blue hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {truncateHash(t.settlement.blockchainTxHash)}
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{expanded.has(t._id) ? '▲' : '▼'}</td>
                    </tr>
                    {expanded.has(t._id) && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="px-4 py-3">
                          {t.settlement ? (
                            <div className="grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                              <p>{t.direction === 'Bought' ? 'You paid' : 'Trade total'}: {formatCurrency(t.totalAmount)}</p>
                              <p>Prosumer earned: {formatCurrency3(t.settlement.prosumerAmount)}</p>
                              <p>Grid wheeling fee: {formatCurrency3(t.settlement.gridWheelAmount)}</p>
                              <p>Platform fee: {formatCurrency3(t.settlement.platformAmount)}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              {t.status === 'settled'
                                ? 'Settlement record not found.'
                                : 'Settlement pending — awaiting verification and T+1 settlement.'}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default TradeHistory
