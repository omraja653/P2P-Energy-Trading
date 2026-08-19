import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/kyc', label: 'KYC' },
  { to: '/admin/trades', label: 'Trades' },
  { to: '/admin/settlements', label: 'Settlements' },
  // Support Tickets reuses the existing agent ticket queue/detail pages
  // (which already allow admin) rather than duplicating that UI here.
  { to: '/support-dashboard', label: 'Support Tickets' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/system-health', label: 'System Health' },
  { to: '/admin/settings', label: 'Settings' },
]

function AdminNav() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive ? 'text-white' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
            style={({ isActive }) => (isActive ? { backgroundColor: 'rgb(0, 150, 135)' } : undefined)}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export default AdminNav
