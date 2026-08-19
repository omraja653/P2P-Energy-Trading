import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import Toast from '../components/Toast.jsx'
import ProfilePictureUpload from '../components/ProfilePictureUpload.jsx'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator.jsx'
import VerificationStatusCard from '../components/VerificationStatusCard.jsx'
import RecentActivityTimeline from '../components/RecentActivityTimeline.jsx'
import RaiseTicketModal from '../components/RaiseTicketModal.jsx'
import { TicketStatusBadge } from '../components/TicketBadges.jsx'
import { formatDateTime } from '../utils/formatting.js'
import { timeAgo } from '../utils/timeAgo.js'
import { passwordChecklist } from '../utils/validation.js'
import {
  fetchProfile,
  updateProfile,
  changePassword,
  updateMobile as requestMobileUpdate,
  fetchProfileTickets,
  fetchProfileActivity,
  deleteAccount,
} from '../services/profile.js'
import { verifyMobileOtp } from '../services/auth.js'

const TABS = [
  { id: 'personal', label: 'Personal Info' },
  { id: 'security', label: 'Account Security' },
  { id: 'verification', label: 'Verification Status' },
  { id: 'tickets', label: 'Support Tickets' },
  { id: 'activity', label: 'Recent Activity' },
]

const BIO_MAX = 200
const draftKey = (userId) => `gridmate-profile-draft-${userId}`

function roleBadgeLabel(type) {
  if (!type) return 'No role'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

// --- Personal Info tab ------------------------------------------------------

function PersonalInfoTab({ profile, onSaved, showToast }) {
  const initial = useMemo(
    () => ({
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio || '',
      address: profile.address || '',
      profilePicture: profile.profilePicture || '',
    }),
    [profile]
  )

  const [form, setForm] = useState(() => {
    const draft = localStorage.getItem(draftKey(profile._id))
    return draft ? JSON.parse(draft) : initial
  })
  const [restoredDraft] = useState(() => Boolean(localStorage.getItem(draftKey(profile._id))))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showMobileUpdate, setShowMobileUpdate] = useState(false)

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)

  useEffect(() => {
    if (isDirty) {
      localStorage.setItem(draftKey(profile._id), JSON.stringify(form))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const updated = await updateProfile(form)
      localStorage.removeItem(draftKey(profile._id))
      onSaved(updated)
      showToast('Changes saved')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save your changes.')
    } finally {
      setSaving(false)
    }
  }

  function discardDraft() {
    localStorage.removeItem(draftKey(profile._id))
    setForm(initial)
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {restoredDraft && isDirty && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Restored unsaved changes from before.{' '}
          <button type="button" onClick={discardDraft} className="font-medium underline">
            Discard them
          </button>
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Profile Picture</label>
        <ProfilePictureUpload
          value={form.profilePicture}
          onChange={(v) => update('profilePicture', v)}
          firstName={form.firstName}
          lastName={form.lastName}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">First Name</label>
          <input
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Last Name</label>
          <input
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">Bio</label>
          <span className={`text-xs ${form.bio.length > BIO_MAX ? 'text-red-600' : 'text-slate-400'}`}>
            {form.bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          value={form.bio}
          onChange={(e) => update('bio', e.target.value.slice(0, BIO_MAX))}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
          placeholder="A short bio, visible on your profile."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
        <input
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Mobile Number</label>
        <div className="flex items-center gap-2">
          <span className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {profile.mobileNumber || 'No number on file'}
          </span>
          <button
            type="button"
            onClick={() => setShowMobileUpdate(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Update
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isDirty && (
        <button
          type="submit"
          disabled={saving || form.bio.length > BIO_MAX}
          style={{ backgroundColor: 'rgb(76, 175, 80)' }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      )}

      {showMobileUpdate && (
        <UpdateMobileModal onClose={() => setShowMobileUpdate(false)} onUpdated={() => window.location.reload()} />
      )}
    </form>
  )
}

// Small inline two-step (number -> OTP) mobile-change flow — changing the
// number always re-triggers verification (security requirement from spec),
// reusing the same verifyMobileOtp endpoint the rest of the app uses.
function UpdateMobileModal({ onClose, onUpdated }) {
  const [step, setStep] = useState('number')
  const [mobileNumber, setMobileNumber] = useState('')
  const [registrationId, setRegistrationId] = useState(null)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleRequest(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await requestMobileUpdate(mobileNumber)
      setRegistrationId(data.registrationId)
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send the code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await verifyMobileOtp(registrationId, otp)
      onUpdated()
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Update mobile number</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {step === 'number' ? (
          <form onSubmit={handleRequest} className="space-y-3">
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+14155552671"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-sm focus:border-teal focus:outline-none"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: 'rgb(0, 150, 135)' }}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-3">
            <p className="text-center text-xs text-slate-500">Code sent to {mobileNumber}</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] focus:border-teal focus:outline-none"
              placeholder="------"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              style={{ backgroundColor: 'rgb(0, 150, 135)' }}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Verifying…' : 'Verify & Save'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// --- Account Security tab ---------------------------------------------------

function AccountSecurityTab({ profile, showToast }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const checklist = passwordChecklist(newPassword)
  const passwordValid = checklist.every((r) => r.valid)
  const isGoogleAccount = profile.authProvider === 'google'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!passwordValid) {
      setError('New password does not meet all requirements.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(oldPassword, newPassword)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast('Password changed')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change your password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isGoogleAccount) {
    return (
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        This account signs in with Google and has no password to change.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-400">
        Password last changed:{' '}
        <span className="font-medium text-slate-600">{profile.passwordChangedAt ? timeAgo(profile.passwordChangedAt) : 'unknown'}</span>
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
        />
        <PasswordStrengthIndicator password={newPassword} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Confirm New Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        style={{ backgroundColor: 'rgb(76, 175, 80)' }}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Changing…' : 'Change Password'}
      </button>
    </form>
  )
}

// --- Support Tickets tab -----------------------------------------------------

function SupportTicketsTab() {
  const [tickets, setTickets] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProfileTickets()
      .then(setTickets)
      .catch(() => setError('Could not load your tickets.'))
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!tickets) return <LoadingSpinner />

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link to="/support" className="text-sm text-brand-blue hover:underline">View All →</Link>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{ backgroundColor: 'rgb(0, 150, 135)' }}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + Raise New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          No tickets yet. Having an issue? Raise a ticket!
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Ticket ID</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t._id}>
                  <td className="px-3 py-2">
                    <Link to={`/support/tickets/${t._id}`} className="font-medium text-brand-blue hover:underline">
                      {t.ticketId}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{t.subject}</td>
                  <td className="px-3 py-2"><TicketStatusBadge status={t.status} /></td>
                  <td className="px-3 py-2 text-slate-500">{formatDateTime(t.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-500">{formatDateTime(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <RaiseTicketModal onClose={() => setShowModal(false)} onCreated={() => window.location.reload()} />
      )}
    </div>
  )
}

// --- Recent Activity tab -----------------------------------------------------

function RecentActivityTab() {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProfileActivity()
      .then(setEvents)
      .catch(() => setError('Could not load recent activity.'))
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!events) return <LoadingSpinner />
  return <RecentActivityTimeline events={events} />
}

// --- Page --------------------------------------------------------------------

function UserProfile() {
  const { user, logout, setSession } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('personal')
  const [toast, setToast] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  function load() {
    setLoading(true)
    fetchProfile()
      .then((data) => setProfile(data))
      .catch(() => setError('Could not load your profile.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  function showToast(message, tone = 'success') {
    setToast({ message, tone })
  }

  function handleProfileSaved(updated) {
    setProfile(updated)
    // Keep the shared session's name/avatar in sync (Navbar reads from it).
    setSession({ user: { ...user, firstName: updated.firstName, lastName: updated.lastName, profilePicture: updated.profilePicture } })
  }

  function hasUnsavedDraft() {
    return Boolean(profile && localStorage.getItem(draftKey(profile._id)))
  }

  function handleLogout() {
    if (hasUnsavedDraft() && !window.confirm('You have unsaved changes. Log out anyway?')) return
    logout()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5] p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5] p-8">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5] py-8">
      <div className="mx-auto max-w-[800px] px-4">
        {/* Top card: avatar + basic info */}
        <div className="rounded-xl p-6 text-white shadow-sm" style={{ backgroundColor: 'rgb(0, 150, 135)' }}>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xl font-bold">
              {profile.profilePicture ? (
                <img src={profile.profilePicture} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">{profile.firstName} {profile.lastName}</h1>
              <p className="truncate text-sm text-white/80">{profile.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              {roleBadgeLabel(profile.type)}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 px-3 pt-3">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'border-b-2 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                style={activeTab === tab.id ? { borderColor: 'rgb(0, 150, 135)' } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === 'personal' && (
              <PersonalInfoTab profile={profile} onSaved={handleProfileSaved} showToast={showToast} />
            )}
            {activeTab === 'security' && <AccountSecurityTab profile={profile} showToast={showToast} />}
            {activeTab === 'verification' && <VerificationStatusCard user={profile} onRefresh={load} />}
            {activeTab === 'tickets' && <SupportTicketsTab />}
            {activeTab === 'activity' && <RecentActivityTab />}
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="text-sm font-medium text-red-600 hover:underline"
          >
            Delete Account
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Logout
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
      {showDeleteModal && (
        <DeleteAccountModal
          isGoogleAccount={profile.authProvider === 'google'}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            logout()
            navigate('/login', { replace: true })
          }}
        />
      )}
    </div>
  )
}

function DeleteAccountModal({ isGoogleAccount, onClose, onDeleted }) {
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleDelete(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await deleteAccount(isGoogleAccount ? undefined : password)
      onDeleted()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete your account.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = confirmText === 'DELETE' && (isGoogleAccount || password.length > 0)

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl">
        <h3 className="font-bold text-red-600">Delete your account?</h3>
        <p className="mt-1 text-sm text-slate-500">
          This permanently deletes your GridMate account. This cannot be undone.
        </p>

        <form onSubmit={handleDelete} className="mt-4 space-y-3">
          {!isGoogleAccount && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
          )}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Type DELETE to confirm</label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Deleting…' : 'Delete Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UserProfile
