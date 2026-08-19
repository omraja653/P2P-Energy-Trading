import { useEffect, useMemo, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import KycDetailModal from '../components/KycDetailModal.jsx'
import Toast from '../components/Toast.jsx'
import { formatDate } from '../utils/formatting.js'
import { fetchKycQueue } from '../services/admin.js'

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
]

function AdminKyc() {
  const [tab, setTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [viewUserId, setViewUserId] = useState(null)
  const [toast, setToast] = useState('')

  function load() {
    setUsers(null)
    fetchKycQueue(tab)
      .then(setUsers)
      .catch(() => setError('Could not load the KYC queue.'))
  }

  useEffect(load, [tab])

  const filtered = useMemo(() => {
    if (!users) return []
    if (!search.trim()) return users
    const term = search.trim().toLowerCase()
    return users.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(term))
  }, [users, search])

  const pendingCount = tab === 'pending' ? users?.length : null

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <AdminNav />
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">KYC Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reviews the account-level <code className="rounded bg-slate-100 px-1">kycVerified</code> flag — there's no document
          upload system in this project yet, so there's nothing to display beyond the user's own account details.
        </p>

        {pendingCount != null && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Pending</p>
              <p className="mt-1 text-xl font-bold text-orange-500">{pendingCount}</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${tab === t.id ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                style={tab === t.id ? { backgroundColor: 'rgb(0, 150, 135)' } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <p className="p-6 text-red-600">{error}</p>
          ) : !users ? (
            <div className="p-6"><LoadingSpinner /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-slate-500">No users in this queue.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">User</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Account Created</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-3 py-2 capitalize text-slate-600">{u.type}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.kycVerified ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
                        {u.kycVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setViewUserId(u._id)} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50">Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewUserId && (
        <KycDetailModal
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
          onDone={() => {
            setViewUserId(null)
            setToast('KYC review saved')
            load()
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}

export default AdminKyc
