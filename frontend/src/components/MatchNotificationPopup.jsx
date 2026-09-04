import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { formatCurrency, formatKwh } from '../utils/formatting.js'
import { fetchUnseenNotifications, markNotificationSeen } from '../services/notifications.js'

const POLL_INTERVAL_MS = 20000

// App-wide "you got matched" popup — polls for unseen TradeNotification rows
// and shows them one at a time. Only for consumer/prosumer accounts (the
// only roles that trade); admin/support never see it. Purely informational:
// there's no accept/reject action here, because by the time a notification
// exists the trade already happened (see backend/services/notificationService.js) —
// this isn't a pending-match confirmation step, just letting the other party
// know asynchronously.
function MatchNotificationPopup() {
  const { user } = useAuth()
  const [queue, setQueue] = useState([])
  const dismissing = useRef(new Set())

  const canTrade = user?.type === 'consumer' || user?.type === 'prosumer'

  useEffect(() => {
    if (!canTrade) return

    let cancelled = false

    async function poll() {
      try {
        const notifications = await fetchUnseenNotifications()
        if (cancelled) return
        setQueue((prev) => {
          const existingIds = new Set(prev.map((n) => n._id))
          const fresh = notifications.filter((n) => !existingIds.has(n._id) && !dismissing.current.has(n._id))
          return [...prev, ...fresh]
        })
      } catch {
        // Silent — a missed poll just tries again next interval.
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [canTrade])

  async function dismiss(id) {
    dismissing.current.add(id)
    setQueue((prev) => prev.filter((n) => n._id !== id))
    try {
      await markNotificationSeen(id)
    } catch {
      // Best-effort — worst case it resurfaces on the next poll.
    }
  }

  if (!canTrade || queue.length === 0) return null

  const notification = queue[0]
  const isBuyerSide = notification.gridRateSavings != null

  return (
    <div className="fixed bottom-6 right-6 z-[80] w-full max-w-sm rounded-xl border-2 border-brand-green bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between">
        <h3 className="font-bold text-brand-green">🎉 Trade Matched!</h3>
        <button type="button" onClick={() => dismiss(notification._id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
          ✕
        </button>
      </div>

      <div className="mt-2 space-y-1 text-sm text-slate-700">
        <p>
          <span className="text-slate-400">With:</span> {notification.counterpartyName}
        </p>
        <p>
          <span className="text-slate-400">Quantity:</span> {formatKwh(notification.quantityKWh)}
        </p>
        <p>
          <span className="text-slate-400">Price:</span> {formatCurrency(notification.pricePerKwh)}/kWh
        </p>
        <p className="font-semibold">
          <span className="font-normal text-slate-400">Total:</span> {formatCurrency(notification.totalAmount)}
        </p>
      </div>

      {isBuyerSide && (
        <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm">
          <p className="font-semibold text-green-700">
            💰 You saved {formatCurrency(notification.gridRateSavings)} vs. grid rate
          </p>
        </div>
      )}

      {queue.length > 1 && <p className="mt-2 text-xs text-slate-400">+{queue.length - 1} more match{queue.length - 1 === 1 ? '' : 'es'}</p>}

      <button
        type="button"
        onClick={() => dismiss(notification._id)}
        style={{ backgroundColor: 'rgb(0, 150, 135)' }}
        className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Got it
      </button>
    </div>
  )
}

export default MatchNotificationPopup
