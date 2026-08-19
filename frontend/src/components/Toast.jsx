import { useEffect } from 'react'

// Minimal self-dismissing toast — no library added for this one notification
// pattern. `onDone` is called after the auto-dismiss timer so the caller can
// clear its state.
function Toast({ message, tone = 'success', onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 3000)
    return () => clearTimeout(timer)
  }, [onDone])

  const toneClass = tone === 'error' ? 'bg-red-600' : tone === 'info' ? 'bg-brand-blue' : 'bg-brand-green'

  return (
    <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2">
      <div className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${toneClass}`}>{message}</div>
    </div>
  )
}

export default Toast
