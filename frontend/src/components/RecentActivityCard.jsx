import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge.jsx'
import { timeAgo } from '../utils/timeAgo.js'

const ICONS = { trade: '⚡', notification: '🎉' }

function RecentActivityCard({ activity }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Recent Activity</h2>
        <Link to="/trade-history" className="text-xs font-medium text-brand-blue hover:underline">
          View All →
        </Link>
      </div>

      {!activity || activity.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Nothing yet — trades and matches will show up here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {activity.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span>{ICONS[item.type] || '•'}</span>
                <span className="text-slate-700">{item.description}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={item.status} />
                <span className="text-xs text-slate-400">{timeAgo(item.timestamp)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default RecentActivityCard
