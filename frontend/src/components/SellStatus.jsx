const STATUS_LABELS = {
  matched: 'Matched',
  verified: 'Verified',
  settled: 'Settled',
  cancelled: 'Cancelled',
}

function SellStatus({ status }) {
  return (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
      {STATUS_LABELS[status] || 'Unknown'}
    </span>
  )
}

export default SellStatus
