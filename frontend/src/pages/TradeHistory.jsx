import { Fragment, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import StatusBadge from '../components/StatusBadge.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatCurrency3, formatKwh, formatDateTime, truncateHash } from '../utils/formatting.js'

const TYPE_FILTERS = ['All', 'Bought', 'Sold']
const STATUS_FILTERS = ['All', 'matched', 'verified', 'settled', 'cancelled']

const EXPLORER_TX_URL = 'https://amoy.polygonscan.com/tx/'

function TradeHistory() {
  const { user } = useAuth()
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expanded, setExpanded] = useState(() => new Set())

  const trades = useFetch('/trades')
  const settlements = useFetch('/settlements')

  const rows = useMemo(() => {
    return (trades.data || [])
      .map((t) => ({
        ...t,
        direction: t.buyerId === user?.id ? 'Bought' : 'Sold',
        settlement: (settlements.data || []).find((s) => (s.tradeId?._id || s.tradeId) === t._id),
      }))
      .filter((t) => typeFilter === 'All' || t.direction === typeFilter)
      .filter((t) => statusFilter === 'All' || t.status === statusFilter)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [trades.data, settlements.data, user?.id, typeFilter, statusFilter])

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
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Trade History & Settlements</h1>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTypeFilter(f)}
              className={`rounded px-3 py-1 text-sm font-medium ${
                typeFilter === f ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded px-3 py-1 text-sm font-medium capitalize ${
                statusFilter === f ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Trades */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <p className="p-4 text-red-600">Failed to load trade history.</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-slate-500">No trades match these filters.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => (
                <Fragment key={t._id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => toggleRow(t._id)}>
                    <td className="px-4 py-2 text-slate-500">{formatDateTime(t.createdAt)}</td>
                    <td className="px-4 py-2">{t.direction}</td>
                    <td className="px-4 py-2">{formatKwh(t.quantityKWh)}</td>
                    <td className="px-4 py-2">{formatCurrency(t.pricePerKwh)}</td>
                    <td className="px-4 py-2">{formatCurrency(t.totalAmount)}</td>
                    <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-2 text-slate-400">{expanded.has(t._id) ? '▲' : '▼'}</td>
                  </tr>
                  {expanded.has(t._id) && (
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="px-4 py-3">
                        {t.settlement ? (
                          <div className="grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                            <p>{t.direction === 'Bought' ? 'You paid' : 'Trade total'}: {formatCurrency(t.totalAmount)}</p>
                            <p>Prosumer earned: {formatCurrency3(t.settlement.prosumerAmount)}</p>
                            <p>Grid wheeling fee: {formatCurrency3(t.settlement.gridWheelAmount)}</p>
                            <p>Platform fee: {formatCurrency3(t.settlement.platformAmount)}</p>
                            <p className="sm:col-span-2">
                              {t.settlement.blockchainTxHash ? (
                                <>
                                  Tx: {truncateHash(t.settlement.blockchainTxHash)}{' '}
                                  <a
                                    href={`${EXPLORER_TX_URL}${t.settlement.blockchainTxHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View on PolygonScan
                                  </a>
                                </>
                              ) : (
                                'Not yet recorded on-chain.'
                              )}
                            </p>
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
  )
}

export default TradeHistory
