export const formatCurrency = (num) => `$${Number(num ?? 0).toFixed(2)}`
export const formatCurrency3 = (num) => `$${Number(num ?? 0).toFixed(3)}`
export const formatKwh = (num) => `${Number(num ?? 0).toFixed(2)} kWh`
export const formatKw = (num) => `${Number(num ?? 0).toFixed(2)} kW`
export const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : '—')
export const formatTime = (date) => (date ? new Date(date).toLocaleTimeString() : '—')
export const formatDateTime = (date) => (date ? new Date(date).toLocaleString() : '—')

export const STATUS_STYLES = {
  matched: { label: 'Matched', icon: '⏳', className: 'bg-yellow-100 text-yellow-700' },
  verified: { label: 'Verified', icon: '⏳', className: 'bg-blue-100 text-blue-700' },
  settled: { label: 'Settled', icon: '✓', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', icon: '✕', className: 'bg-red-100 text-red-700' },
  active: { label: 'Active', icon: '✓', className: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', icon: '✕', className: 'bg-gray-100 text-gray-700' },
}

export function truncateHash(hash) {
  if (!hash) return null
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}
