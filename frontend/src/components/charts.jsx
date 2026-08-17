// Minimal inline-SVG charts — no charting library is installed in this
// project, and pulling one in just for two simple charts isn't worth the
// dependency. Both take real data only; neither fabricates anything.

/** Vertical bar chart. `data`: [{ label, value }]. */
export function BarChart({ data, color = '#009687', height = 160, valueFormatter = (v) => v }) {
  if (!data || data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>
  }

  const max = Math.max(...data.map((d) => d.value), 0.01)
  const barWidth = 100 / data.length

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-40 w-full overflow-visible">
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 20)
          const x = i * barWidth
          return (
            <g key={d.label}>
              <rect
                x={x + barWidth * 0.15}
                y={height - 20 - barHeight}
                width={barWidth * 0.7}
                height={Math.max(barHeight, 1)}
                fill={color}
                rx="1.5"
              >
                <title>{`${d.label}: ${valueFormatter(d.value)}`}</title>
              </rect>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex text-center text-[10px] text-slate-400">
        {data.map((d) => (
          <span key={d.label} style={{ width: `${barWidth}%` }} className="truncate px-0.5">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const DONUT_COLORS = ['#009687', '#4caf50', '#2196f3', '#f59e0b', '#94a3b8']

/** Donut chart. `data`: [{ label, value }]. */
export function DonutChart({ data, size = 160 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (!data || total === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>
  }

  const radius = 15.9155
  const circumference = 2 * Math.PI * radius
  let offsetAccum = 0

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 36 36" style={{ width: size, height: size }} className="shrink-0 -rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        {data.map((d, i) => {
          const fraction = d.value / total
          const dash = fraction * circumference;
          const circle = (
            <circle
              key={d.label}
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="4"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offsetAccum}
              strokeLinecap="butt"
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          )
          offsetAccum += dash
          return circle
        })}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="capitalize text-slate-600">{d.label}</span>
            <span className="font-semibold text-slate-800">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
