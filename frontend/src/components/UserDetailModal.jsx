import { useEffect, useState } from 'react'
import { fetchAdminUserDetail } from '../services/admin.js'
import { formatCurrency, formatDate, formatKwh } from '../utils/formatting.js'
import StatusBadge from './StatusBadge.jsx'
import LoadingSpinner from './LoadingSpinner.jsx'

function VerifiedChip({ label, verified }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${verified ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
      {verified ? '✓' : '⚠'} {label}
    </span>
  )
}

function UserDetailModal({ userId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAdminUserDetail(userId)
      .then(setDetail)
      .catch(() => setError('Could not load this user.'))
  }, [userId])

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">User Details</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!detail && !error && <LoadingSpinner />}

        {detail && (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-slate-900">{detail.user.firstName} {detail.user.lastName}</p>
              <p className="text-sm text-slate-500">{detail.user.email}</p>
              <p className="text-sm text-slate-500">{detail.user.mobileNumber || 'No mobile on file'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">{detail.user.type || 'no role'}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{detail.user.status}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <VerifiedChip label="Email" verified={detail.user.emailVerified} />
              <VerifiedChip label="Mobile" verified={detail.user.mobileVerified} />
              <VerifiedChip label="KYC" verified={detail.user.kycVerified} />
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700">Recent Trades</h4>
              {detail.recentTrades.length === 0 ? (
                <p className="mt-1 text-sm text-slate-400">No trades yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-left uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5">Date</th>
                        <th className="px-2 py-1.5">Qty</th>
                        <th className="px-2 py-1.5">Amount</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.recentTrades.map((t) => (
                        <tr key={t._id}>
                          <td className="px-2 py-1.5 text-slate-500">{formatDate(t.createdAt)}</td>
                          <td className="px-2 py-1.5">{formatKwh(t.quantityKWh)}</td>
                          <td className="px-2 py-1.5">{formatCurrency(t.totalAmount)}</td>
                          <td className="px-2 py-1.5"><StatusBadge status={t.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UserDetailModal
