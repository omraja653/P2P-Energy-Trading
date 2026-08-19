// Human-readable relative timestamps ("2 hours ago", "yesterday"). Built on
// Intl.RelativeTimeFormat (native to the browser, no dependency needed) —
// this naturally uses the browser's local timezone, same as
// toLocaleString() elsewhere in this app.
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const UNITS = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
]

export function timeAgo(date) {
  if (!date) return '—'
  const diffSeconds = (new Date(date).getTime() - Date.now()) / 1000

  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit || unit === 'second') {
      const value = Math.round(diffSeconds / secondsInUnit)
      return rtf.format(value, unit)
    }
  }
  return 'just now'
}
