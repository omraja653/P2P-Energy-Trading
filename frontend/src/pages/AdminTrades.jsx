import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminNav from '../components/AdminNav.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import TradeDetailModal from '../components/TradeDetailModal.jsx'
import DisputeResolutionModal from '../components/DisputeResolutionModal.jsx'
import Toast from '../components/Toast.jsx'
import { formatCurrency, formatDate, formatKwh } from '../utils/formatting.js'
import { fetchAdminTrades, fetchAdminTradeDetail } from '../services/admin.js'

const STATUSES = ['matched', 'verified', 'settled', 'cancelled', 'disputed']

function personName(p) {
  return p ? `${p.firstName} ${p.lastName}` : 'Unknown'
}

function AdminTrades() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [search, setSearch] = useState('')
  const [trades, setTrades] = useState(null)
  const [error, setError] = useState('')
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [resolveTrade, setResolveTrade] = useState(null)
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    fetchAdminTrades({ status: status || undefined })
      .then(setTrades)
      .catch(() => setError('Could not load trades.'))
  }, [status])

  useEffect(load, [load])

  const filtered = trades?.filter((t) => !search.trim() || t._id.includes(search.trim())) || []

  async function openTrade(id) {
    const full = await fetchAdminTradeDetail(id)
    setSelectedTrade(full)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <AdminNav />
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Trade Management</h1>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            placeholder="Search by trade ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <p className="p-6 text-red-600">{error}</p>
          ) : !trades ? (
            <div className="p-6"><LoadingSpinner /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-slate-500">No trades match these filters.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Prosumer</th>
                  <th className="px-3 py-2.5">Consumer</th>
                  <th className="px-3 py-2.5">Volume</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{personName(t.sellerId)}</td>
                    <td className="px-3 py-2">{personName(t.buyerId)}</td>
                    <td className="px-3 py-2">{formatKwh(t.quantityKWh)}</td>
                    <td className="px-3 py-2">{formatCurrency(t.totalAmount)}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(t.createdAt)}</td>
                    <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-2">
                      <button onClick={() => openTrade(t._id)} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onDisputeRaised={() => {
            setSelectedTrade(null)
            setToast('Trade marked as disputed')
            load()
          }}
          onOpenResolve={(trade) => {
            setSelectedTrade(null)
            setResolveTrade(trade)
          }}
        />
      )}

      {resolveTrade && (
        <DisputeResolutionModal
          trade={resolveTrade}
          onClose={() => setResolveTrade(null)}
          onResolved={() => {
            setResolveTrade(null)
            setToast('Dispute resolved — both parties notified')
            load()
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}

export default AdminTrades
