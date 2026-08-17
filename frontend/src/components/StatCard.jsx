const TONE_TEXT = {
  default: 'text-slate-900',
  success: 'text-brand-green',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
  primary: 'text-brand-blue',
}

const TONE_CHIP = {
  default: 'bg-slate-100 text-slate-500',
  success: 'bg-brand-green/10 text-brand-green',
  warning: 'bg-yellow-100 text-yellow-600',
  danger: 'bg-red-100 text-red-600',
  primary: 'bg-brand-blue/10 text-brand-blue',
}

// `icon` is an optional component (e.g. an inline SVG icon) rendered in a
// tone-colored chip — existing callers that don't pass one are unaffected.
function StatCard({ label, value, sublabel, tone = 'default', icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[tone] || TONE_CHIP.default}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <p className={`mt-2 text-2xl font-bold ${TONE_TEXT[tone] || TONE_TEXT.default}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
    </div>
  )
}

export default StatCard
