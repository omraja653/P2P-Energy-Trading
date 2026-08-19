import { timeAgo } from '../utils/timeAgo.js'

const ICONS = {
  login: '🔑',
  trade: '⚡',
  ticket: '🎫',
}

function RecentActivityTimeline({ events }) {
  if (!events || events.length === 0) {
    return <p className="text-sm text-slate-500">No recent activity yet.</p>
  }

  return (
    <ol className="space-y-4">
      {events.map((event, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">
            {ICONS[event.type] || '•'}
          </span>
          <div>
            <p className="text-sm text-slate-700">{event.description}</p>
            <p className="text-xs text-slate-400" title={new Date(event.timestamp).toLocaleString()}>
              {timeAgo(event.timestamp)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default RecentActivityTimeline
