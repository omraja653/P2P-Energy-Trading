// Small inline-SVG icon set shared across the redesigned dashboard/marketplace
// pages — no icon library is installed, and adding one for a handful of
// glyphs isn't worth the dependency.

export function SunIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  )
}

export function PlugIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 2v4M15 2v4M7 8h10v4a5 5 0 0 1-10 0V8z" />
      <path d="M12 17v5" />
    </svg>
  )
}

export function BoltIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  )
}

export function CashIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 6v.01M18 18v-.01" />
    </svg>
  )
}

export function ListIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

export function BasketIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 9h18l-1.6 10.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function PiggyBankIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 9a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1v2a3 3 0 0 1-3 3H8a4 4 0 0 1-4-4v-1a5 5 0 0 1 5-5h2l2-2h2l1 2h1z" />
      <circle cx="8" cy="13" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ReceiptIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 2h12v20l-2.5-1.5L13 22l-2.5-1.5L8 22l-2-1.5V2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  )
}
