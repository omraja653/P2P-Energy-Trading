export const formatCurrency = (num) => `₹${Number(num ?? 0).toFixed(2)}`
export const formatCurrency3 = (num) => `₹${Number(num ?? 0).toFixed(3)}`
export const formatKwh = (num) => `${Number(num ?? 0).toFixed(2)} kWh`
export const formatKw = (num) => `${Number(num ?? 0).toFixed(2)} kW`
export const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : '—')
export const formatTime = (date) => (date ? new Date(date).toLocaleTimeString() : '—')
export const formatDateTime = (date) => (date ? new Date(date).toLocaleString() : '—')

export const STATUS_STYLES = {
  pending: { label: 'Pending', icon: '●', className: 'bg-yellow-100 text-yellow-700' },
  matched: { label: 'Matched', icon: '⏳', className: 'bg-yellow-100 text-yellow-700' },
  verified: { label: 'Verified', icon: '⏳', className: 'bg-blue-100 text-blue-700' },
  settled: { label: 'Settled', icon: '✓', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', icon: '✕', className: 'bg-red-100 text-red-700' },
  active: { label: 'Active', icon: '✓', className: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', icon: '✕', className: 'bg-gray-100 text-gray-700' },
  disputed: { label: 'Disputed', icon: '⚠', className: 'bg-orange-100 text-orange-700' },
}

// Support ticket status/priority badge colors — per spec: Open=blue,
// Pending=orange, In Progress=teal, Resolved=green, Closed=gray;
// Urgent=red, High=orange, Medium=yellow, Low=gray.
export const TICKET_STATUS_STYLES = {
  Open: { label: 'Open', icon: '●', className: 'bg-blue-100 text-blue-700' },
  Pending: { label: 'Pending', icon: '●', className: 'bg-orange-100 text-orange-700' },
  // Uses cyan rather than the app's custom `teal` token — that token is a
  // flat override (see tailwind.config.js), so shade classes like
  // `teal-100`/`teal-800` don't resolve; cyan gives the same visual family.
  'In Progress': { label: 'In Progress', icon: '●', className: 'bg-cyan-100 text-cyan-800' },
  Resolved: { label: 'Resolved', icon: '✓', className: 'bg-green-100 text-green-700' },
  Closed: { label: 'Closed', icon: '✕', className: 'bg-gray-100 text-gray-600' },
}

export const TICKET_PRIORITY_STYLES = {
  Urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700' },
  High: { label: 'High', className: 'bg-orange-100 text-orange-700' },
  Medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700' },
  Low: { label: 'Low', className: 'bg-gray-100 text-gray-600' },
}

export const TICKET_CATEGORIES = ['Bug Report', 'Billing', 'General Inquiry', 'Feature Request', 'Trading Issue']
export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
export const TICKET_STATUSES = ['Open', 'Pending', 'In Progress', 'Resolved', 'Closed']

export function truncateHash(hash) {
  if (!hash) return null
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}
