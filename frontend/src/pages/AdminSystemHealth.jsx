import { useEffect, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import Toast from '../components/Toast.jsx'
import { formatDateTime } from '../utils/formatting.js'
import { fetchSystemHealth, sendBroadcast, fetchBroadcasts } from '../services/admin.js'

const GOOD_STATES = ['connected', 'online', 'configured']

function HealthCard({ label, status }) {
  const isGood = GOOD_STATES.includes(status)
  const isNeutral = status?.startsWith('not configured')
  const color = isGood ? 'bg-green-100 text-green-700' : isNeutral ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  const dot = isGood ? 'bg-green-500' : isNeutral ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {status}
      </div>
    </div>
  )
}

function AdminSystemHealth() {
  const [health, setHealth] = useState(null)
  const [broadcasts, setBroadcasts] = useState(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  function loadHealth() {
    fetchSystemHealth().then(setHealth).catch(() => setError('Could not load system health.'))
  }
  function loadBroadcasts() {
    fetchBroadcasts().then(setBroadcasts).catch(() => {})
  }

  useEffect(() => {
    loadHealth()
    loadBroadcasts()
  }, [])

  async function handleBroadcast(e) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    try {
      const result = await sendBroadcast(subject.trim(), message.trim())
      setToast(`Sent to ${result.recipientCount} users`)
      setSubject('')
      setMessage('')
      loadBroadcasts()
    } catch (err) {
      setToast(err.response?.data?.error || 'Could not send broadcast.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">System Health</h1>

        {error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : !health ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <HealthCard label="MongoDB Connection" status={health.database} />
              <HealthCard label="API Server" status={health.api} />
              <HealthCard label="Blockchain (Polygon Amoy)" status={health.blockchain} />
              <HealthCard label="Email Service (Brevo)" status={health.email} />
              <HealthCard label="SMS Service (Twilio)" status={health.sms} />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Checked {formatDateTime(health.checkedAt)}. There's no error-log capture in this project yet, so a "recent errors"
              list isn't shown here — it would otherwise have to be fabricated.
            </p>
          </>
        )}

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Broadcast a System Notification</h2>
          <p className="mt-1 text-xs text-slate-400">
            Emails every active user directly — there's no in-app notification center to post into instead.
          </p>
          <form onSubmit={handleBroadcast} className="mt-3 space-y-3">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Message"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending}
              style={{ backgroundColor: 'rgb(0, 150, 135)' }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send to All Active Users'}
            </button>
          </form>

          {broadcasts?.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">Recent Broadcasts</h3>
              <ul className="mt-2 space-y-2">
                {broadcasts.map((b) => (
                  <li key={b._id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-800">{b.subject}</p>
                    <p className="text-slate-500">{b.message}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Sent to {b.recipientCount} users by {b.sentBy?.firstName || 'admin'} — {formatDateTime(b.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}

export default AdminSystemHealth
