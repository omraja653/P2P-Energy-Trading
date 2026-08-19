import { useState } from 'react'

// Generic confirmation dialog for dangerous admin actions (suspend, block,
// delete, reject). `requireReason` shows a mandatory textarea (e.g. KYC
// rejection reason) whose value is passed to onConfirm.
function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = true, requireReason, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (requireReason && !reason.trim()) {
      setError(`${requireReason} is required`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl">
        <h3 className={`font-bold ${danger ? 'text-red-600' : 'text-slate-900'}`}>{title}</h3>
        {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}

        {requireReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={requireReason}
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
            autoFocus
          />
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 ${
              danger ? 'bg-red-600' : 'bg-brand-green'
            }`}
          >
            {submitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
