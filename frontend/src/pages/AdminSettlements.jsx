import { useCallback, useEffect, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import Toast from '../components/Toast.jsx'
import { formatCurrency, formatDateTime, truncateHash } from '../utils/formatting.js'
import { fetchAdminSettlements, fetchAdminSettlementDetail, setSettlementStatus } from '../services/admin.js'

const EXPLORER_BASE = 'https://amoy.polygonscan.com/tx/'
const STATUSES = ['pending', 'completed', 'failed']

function statusTone(status) {
  if (status === 'completed') return 'bg-green-100 text-green-700'
  if (status === 'failed') return 'bg-red-100 text-red-700'
  return 'bg-yellow-100 text-yellow-700'
}

function personName(p) {
  return p ? `${p.firstName} ${p.lastName}` : 'Unknown'
}

function SettlementDetailModal({ id, onClose, onChanged }) {
  const [settlement, setSettlement] = useState(null)
  const [overrideStatus, setOverrideStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAdminSettlementDetail(id).then((s) => {
      setSettlement(s)
      setOverrideStatus(s.status)
    })
  }, [id])

  async function handleOverride() {
    setBusy(true)
    setError('')
    try {
      await setSettlementStatus(id, overrideStatus)
      onChanged()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status.')
      setBusy(false)
    }
  }

  if (!settlement) {
    return (
      <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><LoadingSpinner /></div>
      </div>
    )
  }

  const trade = settlement.tradeId

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Settlement Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Prosumer</span><span>{personName(trade?.sellerId)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Consumer</span><span>{personName(trade?.buyerId)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Prosumer Pay</span><span>{formatCurrency(settlement.prosumerAmount)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Grid Wheel Fee</span><span>{formatCurrency(settlement.gridWheelAmount)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Platform Fee</span><span>{formatCurrency(settlement.platformAmount)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Status</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(settlement.status)}`}>{settlement.status}</span></div>
          {settlement.blockchainTxHash && (
            <div className="flex justify-between">
              <span className="text-slate-400">TX Hash</span>
              <a href={`${EXPLORER_BASE}${settlement.blockchainTxHash}`} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">
                {truncateHash(settlement.blockchainTxHash)} ↗
              </a>
            </div>
          )}
          {settlement.settledAt && <div className="flex justify-between"><span className="text-slate-400">Settled</span><span>{formatDateTime(settlement.settledAt)}</span></div>}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">Manual override (if blockchain verification failed)</p>
          <div className="mt-2 flex gap-2">
            <select value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleOverride} disabled={busy || overrideStatus === settlement.status} className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy ? 'Saving…' : 'Apply'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function AdminSettlements() {
  const [status, setStatus] = useState('')
  const [settlements, setSettlements] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    fetchAdminSettlements({ status: status || undefined })
      .then(setSettlements)
      .catch(() => setError('Could not load settlements.'))
  }, [status])

  useEffect(load, [load])

  const metrics = settlements
    ? {
        totalSettled: settlements.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.prosumerAmount + s.gridWheelAmount + s.platformAmount, 0),
        successRate: settlements.length ? (settlements.filter((s) => s.status === 'completed').length / settlements.length) * 100 : 0,
      }
    : null

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Settlement Oversight</h1>

        {metrics && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Total Settled</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(metrics.totalSettled)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Success Rate</p>
              <p className="mt-1 text-xl font-bold text-brand-green">{metrics.successRate.toFixed(1)}%</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <p className="p-6 text-red-600">{error}</p>
          ) : !settlements ? (
            <div className="p-6"><LoadingSpinner /></div>
          ) : settlements.length === 0 ? (
            <p className="p-6 text-slate-500">No settlements match these filters.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Prosumer</th>
                  <th className="px-3 py-2.5">Consumer</th>
                  <th className="px-3 py-2.5">Prosumer Pay</th>
                  <th className="px-3 py-2.5">Grid Fee</th>
                  <th className="px-3 py-2.5">Platform Fee</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((s) => (
                  <tr key={s._id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedId(s._id)}>
                    <td className="px-3 py-2">{personName(s.tradeId?.sellerId)}</td>
                    <td className="px-3 py-2">{personName(s.tradeId?.buyerId)}</td>
                    <td className="px-3 py-2">{formatCurrency(s.prosumerAmount)}</td>
                    <td className="px-3 py-2">{formatCurrency(s.gridWheelAmount)}</td>
                    <td className="px-3 py-2">{formatCurrency(s.platformAmount)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(s.status)}`}>{s.status}</span></td>
                    <td className="px-3 py-2 text-slate-500">{formatDateTime(s.createdAt)}</td>
                    <td className="px-3 py-2 text-brand-blue">View</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedId && (
        <SettlementDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => {
            setSelectedId(null)
            setToast('Settlement status updated')
            load()
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}

export default AdminSettlements
