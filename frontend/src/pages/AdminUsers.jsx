import { useCallback, useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import UserDetailModal from '../components/UserDetailModal.jsx'
import Toast from '../components/Toast.jsx'
import { formatDate } from '../utils/formatting.js'
import {
  fetchAdminUsers,
  setUserStatus,
  verifyUserEmail,
  verifyUserMobile,
  deleteAdminUser,
} from '../services/admin.js'

const ROLES = ['consumer', 'prosumer', 'support', 'admin']

function VerifiedDot({ verified }) {
  return <span className={verified ? 'text-brand-green' : 'text-orange-500'}>{verified ? '✓' : '⚠'}</span>
}

function statusToneClass(status) {
  if (status === 'ACTIVE') return 'bg-green-100 text-green-700'
  if (status === 'SUSPENDED') return 'bg-orange-100 text-orange-700'
  if (status === 'BLOCKED') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-600'
}

function AdminUsers() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ role: '', status: '', kycVerified: '', search: '' })
  const [selected, setSelected] = useState(new Set())
  const [viewUserId, setViewUserId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { type, user }
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminUsers({
        role: filters.role || undefined,
        status: filters.status || undefined,
        kycVerified: filters.kycVerified || undefined,
        search: filters.search || undefined,
      })
      setUsers(data)
      setSelected(new Set())
    } catch (err) {
      setError('Could not load users.')
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function bulkVerifyEmail() {
    await Promise.allSettled([...selected].map((id) => verifyUserEmail(id)))
    setToast('Verified email for selected users')
    load()
  }

  async function bulkSuspend() {
    await Promise.allSettled([...selected].map((id) => setUserStatus(id, 'SUSPENDED')))
    setToast('Suspended selected users')
    load()
  }

  async function handleQuickAction(user, action) {
    try {
      if (action === 'verify-email') await verifyUserEmail(user._id)
      if (action === 'verify-mobile') await verifyUserMobile(user._id)
      if (action === 'suspend') await setUserStatus(user._id, 'SUSPENDED')
      if (action === 'activate') await setUserStatus(user._id, 'ACTIVE')
      setToast('Updated')
      load()
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Action failed', tone: 'error' })
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <AdminNav />
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            placeholder="Search name, email…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
          />
          <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="">All Roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BLOCKED">Blocked</option>
            <option value="PENDING">Pending</option>
          </select>
          <select value={filters.kycVerified} onChange={(e) => setFilters((f) => ({ ...f, kycVerified: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="">KYC: Any</option>
            <option value="true">KYC Verified</option>
            <option value="false">KYC Unverified</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm">
            <span className="font-medium text-slate-600">{selected.size} selected</span>
            <button onClick={bulkVerifyEmail} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50">Verify All Emails</button>
            <button onClick={bulkSuspend} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50">Suspend All</button>
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <p className="p-6 text-red-600">{error}</p>
          ) : !users ? (
            <div className="p-6"><LoadingSpinner /></div>
          ) : users.length === 0 ? (
            <p className="p-6 text-slate-500">No users match these filters.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(users.map((u) => u._id)) : new Set())} /></th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Mobile</th>
                  <th className="px-3 py-2.5">KYC</th>
                  <th className="px-3 py-2.5">Created</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.has(u._id)} onChange={() => toggleSelect(u._id)} /></td>
                    <td className="px-3 py-2">
                      <button onClick={() => setViewUserId(u._id)} className="font-medium text-brand-blue hover:underline">{u.firstName} {u.lastName}</button>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{u.email}</td>
                    <td className="px-3 py-2 capitalize text-slate-600">{u.type || '—'}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusToneClass(u.status)}`}>{u.status}</span></td>
                    <td className="px-3 py-2"><VerifiedDot verified={u.emailVerified} /></td>
                    <td className="px-3 py-2"><VerifiedDot verified={u.mobileVerified} /></td>
                    <td className="px-3 py-2"><VerifiedDot verified={u.kycVerified} /></td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {!u.emailVerified && <button onClick={() => handleQuickAction(u, 'verify-email')} className="rounded border border-slate-300 px-1.5 py-0.5 text-xs hover:bg-slate-50">Verify Email</button>}
                        {!u.mobileVerified && <button onClick={() => handleQuickAction(u, 'verify-mobile')} className="rounded border border-slate-300 px-1.5 py-0.5 text-xs hover:bg-slate-50">Verify Mobile</button>}
                        {u.status === 'ACTIVE' ? (
                          <button onClick={() => handleQuickAction(u, 'suspend')} className="rounded border border-orange-300 px-1.5 py-0.5 text-xs text-orange-600 hover:bg-orange-50">Suspend</button>
                        ) : (
                          <button onClick={() => handleQuickAction(u, 'activate')} className="rounded border border-green-300 px-1.5 py-0.5 text-xs text-green-600 hover:bg-green-50">Activate</button>
                        )}
                        <button onClick={() => setConfirmAction({ type: 'block', user: u })} className="rounded border border-red-300 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50">Block</button>
                        <button onClick={() => setConfirmAction({ type: 'delete', user: u })} className="rounded border border-red-300 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewUserId && <UserDetailModal userId={viewUserId} onClose={() => setViewUserId(null)} />}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.type === 'block' ? `Block ${confirmAction.user.firstName}?` : `Delete ${confirmAction.user.firstName}'s account?`}
          message={
            confirmAction.type === 'block'
              ? 'This immediately prevents them from logging in.'
              : 'This permanently deletes the account. This cannot be undone.'
          }
          confirmLabel={confirmAction.type === 'block' ? 'Block User' : 'Delete Account'}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            if (confirmAction.type === 'block') await setUserStatus(confirmAction.user._id, 'BLOCKED')
            if (confirmAction.type === 'delete') await deleteAdminUser(confirmAction.user._id)
            setConfirmAction(null)
            setToast(confirmAction.type === 'block' ? 'User blocked' : 'User deleted')
            load()
          }}
        />
      )}

      {toast && <Toast message={typeof toast === 'string' ? toast : toast.message} tone={typeof toast === 'object' ? toast.tone : 'success'} onDone={() => setToast(null)} />}
    </div>
  )
}

export default AdminUsers
