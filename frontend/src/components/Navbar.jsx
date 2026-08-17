import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { dashboardPathFor } from '../utils/dashboardPath.js'

// Forced via inline style, not a Tailwind token — guarantees the exact
// requested color renders regardless of any Tailwind config/build caching.
const TEAL_BG = 'rgb(0, 150, 135)'
const SWITCHABLE_ROLES = ['consumer', 'prosumer']

function NavLinkItem({ to, children }) {
  return (
    <Link
      to={to}
      style={{ color: '#ffffff' }}
      className="rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/15"
    >
      {children}
    </Link>
  )
}

function UserDropdown({ user }) {
  const { updateUserRole } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')

  async function switchRole(type) {
    if (type === user.type || switching) return
    setError('')
    setSwitching(true)
    try {
      await updateUserRole(type)
      setOpen(false)
      navigate(dashboardPathFor(type), { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not switch role')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ color: '#ffffff' }}
        className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/25"
      >
        <span>{user.firstName}</span>
        <span className="capitalize text-white/80">({user.type || 'no role'})</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg bg-white text-slate-800 shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="font-semibold">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <div className="px-2 py-2">
              {user.type === 'admin' ? (
                <p className="px-2 py-1.5 text-sm font-medium text-slate-700">Admin</p>
              ) : (
                <>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Switch role
                  </p>
                  {SWITCHABLE_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      disabled={switching}
                      onClick={() => switchRole(role)}
                      className={`block w-full rounded px-2 py-1.5 text-left text-sm capitalize transition hover:bg-slate-50 disabled:opacity-50 ${
                        role === user.type ? 'font-semibold text-green-600' : 'text-slate-600'
                      }`}
                    >
                      {role} {role === user.type && '✓'}
                    </button>
                  ))}
                  {error && <p className="px-2 pt-1 text-xs text-red-600">{error}</p>}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const dashboardPath = dashboardPathFor(user?.type) || '/login'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav style={{ backgroundColor: TEAL_BG }} className="sticky top-0 z-30 w-full shadow-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link to={dashboardPath} style={{ color: '#ffffff' }} className="flex items-center gap-2 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base">⚡</span>
          <span>GridMate</span>
        </Link>

        {/* Links */}
        <div className="flex flex-wrap items-center gap-1">
          <NavLinkItem to={dashboardPath}>Dashboard</NavLinkItem>
          <NavLinkItem to="/marketplace">Marketplace</NavLinkItem>
          <NavLinkItem to="/trade-history">Trade History</NavLinkItem>
        </div>

        {/* User dropdown + Logout */}
        <div className="flex items-center gap-2">
          {user && <UserDropdown user={user} />}
          <button
            type="button"
            onClick={handleLogout}
            style={{ color: '#ffffff' }}
            className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/25"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
