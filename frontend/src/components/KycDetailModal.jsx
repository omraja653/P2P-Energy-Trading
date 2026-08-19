import { useEffect, useState } from 'react'
import { fetchKycDetail, approveKyc, rejectKyc, requestKycResubmit } from '../services/admin.js'
import { formatDate } from '../utils/formatting.js'
import LoadingSpinner from './LoadingSpinner.jsx'

// There's no document-upload/KYC-submission system in this project (see
// services/adminKycService.js) — no ID/address/selfie images to show here.
// This reviews the same `kycVerified` boolean the rest of the app uses,
// with the details the User document actually has (name, role, address).
function KycDetailModal({ userId, onClose, onDone }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('view') // 'view' | 'reject' | 'resubmit'

  useEffect(() => {
    fetchKycDetail(userId).then(setUser).catch(() => setError('Could not load this submission.'))
  }, [userId])

  async function handleApprove() {
    setBusy(true)
    try {
      await approveKyc(userId, notes)
      onDone()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not approve.')
      setBusy(false)
    }
  }

  async function handleReject() {
    if (!reason.trim()) return setError('A reason is required to reject.')
    setBusy(true)
    try {
      await rejectKyc(userId, reason)
      onDone()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reject.')
      setBusy(false)
    }
  }

  async function handleResubmit() {
    setBusy(true)
    try {
      await requestKycResubmit(userId, reason)
      onDone()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send request.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">KYC Review</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {!user && !error && <LoadingSpinner />}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {user && (
          <div className="space-y-4">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              No document upload system exists yet — this reviews the account's verification flag, not submitted ID/address/selfie images.
            </p>

            <div className="space-y-1 text-sm">
              <p><span className="text-slate-400">Name:</span> {user.firstName} {user.lastName}</p>
              <p><span className="text-slate-400">Email:</span> {user.email}</p>
              <p><span className="text-slate-400">Role:</span> <span className="capitalize">{user.type}</span></p>
              <p><span className="text-slate-400">Address on file:</span> {user.address || '—'}</p>
              <p><span className="text-slate-400">Account created:</span> {formatDate(user.createdAt)}</p>
              <p><span className="text-slate-400">Current KYC status:</span> {user.kycVerified ? 'Verified' : 'Unverified'}</p>
            </div>

            {mode === 'view' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Approval notes (optional)</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleApprove} disabled={busy} className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">Approve</button>
                  <button onClick={() => setMode('reject')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">Reject</button>
                  <button onClick={() => setMode('resubmit')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Request Resubmit</button>
                </div>
              </>
            )}

            {mode === 'reject' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Reason for rejection (required)</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none" />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setMode('view')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={handleReject} disabled={busy} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">Confirm Reject</button>
                </div>
              </div>
            )}

            {mode === 'resubmit' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Message to user</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus placeholder="What do you need them to resubmit?" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setMode('view')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={handleResubmit} disabled={busy} className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">Send Request</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default KycDetailModal
