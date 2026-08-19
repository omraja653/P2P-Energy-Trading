// Metric card with an optional trend indicator (up/down % vs a prior
// period). `trend` is a signed number, e.g. 12.5 or -3.2; null/undefined
// hides the indicator entirely rather than showing a fake "0%".
function MetricsCard({ label, value, trend, sublabel }) {
  const hasTrend = trend !== null && trend !== undefined
  const isUp = hasTrend && trend >= 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline justify-between">
        <p className="text-xl font-bold text-slate-900">{value}</p>
        {hasTrend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-brand-green' : 'text-red-500'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
    </div>
  )
}

export default MetricsCard
