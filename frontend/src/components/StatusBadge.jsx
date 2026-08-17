import { STATUS_STYLES } from '../utils/formatting.js'

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { label: status || 'Unknown', icon: '', className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${style.className}`}>
      {style.icon} {style.label}
    </span>
  )
}

export default StatusBadge
