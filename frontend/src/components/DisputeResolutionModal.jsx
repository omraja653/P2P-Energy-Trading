import { useState } from 'react'
import { resolveTradeDispute } from '../services/admin.js'

const DECISIONS = [
  { value: 'approve_trade', label: 'Approve Trade (no change)' },
  { value: 'refund_consumer', label: 'Refund Consumer' },
  { value: 'refund_both', label: 'Refund Both Parties' },
  { value: 'no_action', label: 'No Action Needed' },
]

// Refund decisions here only record the decision + set the trade to
// 'cancelled' — there's no payment-reversal system in this project to
// actually move money back, so nothing here fakes a real refund.
function DisputeResolutionModal({ trade, onClose, onResolved }) {
  const [decision, setDecision] = useState('approve_trade')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!notes.trim()) return setError('Notes are required.')
    setSubmitting(true)
    setError('')
    try {
      await resolveTradeDispute(trade._id, decision, notes.trim())
      onResolved()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resolve this dispute.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <h3 className="font-bold text-slate-900">Resolve Dispute</h3>
        <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{trade.dispute?.reason}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Decision</label>
            <select value={decision} onChange={(e) => setDecision(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none">
              {DECISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Resolution Notes (required)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Both parties are automatically emailed the decision and notes when you resolve this — that always happens, there's no way to opt out.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Resolving…' : 'Resolve Dispute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DisputeResolutionModal
