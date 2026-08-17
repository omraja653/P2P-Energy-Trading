const TONE_CLASSES = {
  default: 'text-slate-900',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
  primary: 'text-blue-600',
}

function StatCard({ label, value, sublabel, tone = 'default' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${TONE_CLASSES[tone] || TONE_CLASSES.default}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
    </div>
  )
}

export default StatCard
