import { TICKET_STATUS_STYLES, TICKET_PRIORITY_STYLES } from '../utils/formatting.js'

export function TicketStatusBadge({ status }) {
  const style = TICKET_STATUS_STYLES[status] || { label: status || 'Unknown', icon: '', className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${style.className}`}>
      {style.icon} {style.label}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const style = TICKET_PRIORITY_STYLES[priority] || { label: priority || 'Unknown', className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  )
}
