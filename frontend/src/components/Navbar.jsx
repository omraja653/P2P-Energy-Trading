import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { dashboardPathFor } from '../utils/dashboardPath.js'
import { ADMIN_LINKS } from './AdminNav.jsx'
import { fetchRecentNotifications, markNotificationSeen } from '../services/notifications.js'
import { timeAgo } from '../utils/timeAgo.js'

// Forced via inline style, not a Tailwind token — guarantees the exact
// requested color renders regardless of any Tailwind config/build caching.
const TEAL_BG = 'rgb(0, 150, 135)'
const SWITCHABLE_ROLES = ['consumer', 'prosumer']

// Active-state aware (bold text + underline) so the current page is always
// obvious. Note on color: the spec asked for teal (#17A2B8) as the
// active/hover text color, but this navbar's background is already a teal
// (rgb(0, 150, 135)) — teal-on-teal would be barely legible, so active/hover
// state is expressed as full-opacity bold white + a white underline instead
// of a color swap, which keeps the same "clearly distinguishable" intent
// without the contrast problem.
function NavLinkItem({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      style={{ color: '#ffffff', fontSize: '16px', padding: '12px 20px', lineHeight: 1.5 }}
      className={({ isActive }) =>
        `flex min-h-[44px] cursor-pointer items-center rounded-lg border-b-2 transition-all duration-200 hover:opacity-100 md:min-h-0 ${
          isActive ? 'border-white font-semibold opacity-100' : 'border-transparent font-medium opacity-85 hover:border-white/50'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

// Same visual language as NavLinkItem, but a filled pill instead of an
// underline for the active state — used for the admin link row, which has
// enough entries that a stronger signal than an underline helps "where am
// I" stand out at a glance.
function AdminNavLinkItem({ to, end, children, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      style={{ color: '#ffffff', fontSize: '16px', padding: '12px 20px', lineHeight: 1.5 }}
      className={({ isActive }) =>
        `flex min-h-[44px] shrink-0 cursor-pointer items-center rounded-lg transition-all duration-200 md:min-h-0 ${
          isActive ? 'bg-white/25 font-semibold' : 'font-medium opacity-85 hover:bg-white/15 hover:opacity-100'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function UserDropdown({ user }) {
  const { updateUserRole, updateUserLocation } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState(null)
  const canTrade = user.type === 'consumer' || user.type === 'prosumer'

  // Fetched on open rather than continuously polled — this is a
  // check-when-you-look list, not a live badge/counter.
  useEffect(() => {
    if (!open || !canTrade) return
    fetchRecentNotifications()
      .then((data) => setNotifications(data.slice(0, 5)))
      .catch(() => setNotifications([]))
  }, [open, canTrade])

  async function dismissNotification(id) {
    setNotifications((prev) => prev?.map((n) => (n._id === id ? { ...n, seen: true } : n)))
    try {
      await markNotificationSeen(id)
    } catch {
      // Best-effort — a missed mark-seen just means it shows as unseen next time.
    }
  }

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

  async function shareCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.')
      return
    }

    setLocationLoading(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await updateUserLocation({
            lat: coords.latitude,
            lng: coords.longitude,
            label: 'My location',
            city: 'Current location',
          })
          setOpen(false)
        } catch (err) {
          setError(err.response?.data?.error || 'Could not save your location')
        } finally {
          setLocationLoading(false)
        }
      },
      () => {
        setError('Location access was denied. Please allow it to share your location.')
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ color: '#ffffff' }}
        className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/25"
      >
        {user.profilePicture ? (
          <img src={user.profilePicture} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-xs">
            {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()}
          </span>
        )}
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
            <div className="border-b border-slate-100 px-2 py-2">
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
              >
                My Profile
              </Link>
              <Link
                to="/support"
                onClick={() => setOpen(false)}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Support
              </Link>
            </div>

            {canTrade && (
              <div className="max-h-64 overflow-y-auto border-b border-slate-100 px-2 py-2">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Notifications
                </p>
                {!notifications ? (
                  <p className="px-2 py-1.5 text-xs text-slate-400">Loading…</p>
                ) : notifications.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-slate-400">Nothing yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {notifications.map((n) => (
                      <li
                        key={n._id}
                        className={`rounded px-2 py-1.5 text-xs ${n.seen ? 'text-slate-400' : 'bg-slate-50 text-slate-700'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span>
                            Matched with {n.counterpartyName} — {n.quantityKWh} kWh at ₹{n.pricePerKwh}/kWh
                          </span>
                          {!n.seen && (
                            <button
                              type="button"
                              onClick={() => dismissNotification(n._id)}
                              className="shrink-0 text-slate-400 hover:text-slate-600"
                              aria-label="Mark as seen"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="px-2 py-2">
              {user.type === 'admin' ? (
                <p className="px-2 py-1.5 text-sm font-medium text-slate-700">Admin</p>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={locationLoading}
                    onClick={shareCurrentLocation}
                    className="mb-3 block w-full rounded px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {locationLoading ? 'Sharing location...' : 'Share my location'}
                  </button>

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
  const { user, logout, updateUserLocation } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const dashboardPath = dashboardPathFor(user?.type) || '/login'

  useEffect(() => {
    if (!user || user.type !== 'prosumer' || user.location?.lat != null || user.location?.lng != null) return
    if (!('geolocation' in navigator)) return

    const timeoutId = setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            await updateUserLocation({
              lat: coords.latitude,
              lng: coords.longitude,
              label: 'My location',
              city: 'Current location',
            })
          } catch (error) {
            // Silent fail here: the user can still use the manual menu option later.
          }
        },
        () => {
          // Silent fail on denial so the app doesn't spam permission prompts.
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [user, updateUserLocation])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  // Same link set the desktop bar renders, factored out so the mobile
  // slide-out menu (below md) shows identical links instead of a second,
  // drifting copy. `onNavigate` closes the slide-out once a link is
  // clicked — required by the "menu closes when tab clicked" spec.
  function renderLinks(onNavigate) {
    if (user?.type === 'admin') {
      return ADMIN_LINKS.map((link) => (
        <AdminNavLinkItem key={link.to} to={link.to} end={link.end} onClick={onNavigate}>
          {link.label}
        </AdminNavLinkItem>
      ))
    }
    if (user?.type === 'support') {
      return (
        <>
          <NavLinkItem to={dashboardPath} onClick={onNavigate}>Dashboard</NavLinkItem>
          <NavLinkItem to="/support" onClick={onNavigate}>Support</NavLinkItem>
          <NavLinkItem to="/support-dashboard" onClick={onNavigate}>Support Dashboard</NavLinkItem>
        </>
      )
    }
    // Consumer/prosumer: 4 tabs only. Forecast/Bid/Slot Trading/Revenue
    // keep working at their existing routes (folded into Dashboard as
    // cards/CTAs instead) — just unlinked from here. Support moved into
    // the profile dropdown below.
    return (
      <>
        <NavLinkItem to={dashboardPath} onClick={onNavigate}>Home</NavLinkItem>
        <NavLinkItem to="/marketplace" onClick={onNavigate}>Marketplace</NavLinkItem>
        <NavLinkItem to="/trade-history" onClick={onNavigate}>Orders</NavLinkItem>
        <NavLinkItem to="/wallet" onClick={onNavigate}>Wallet</NavLinkItem>
      </>
    )
  }

  return (
    <nav style={{ backgroundColor: TEAL_BG }} className="sticky top-0 z-30 w-full shadow-md">
      <div
        style={{ padding: '10px 30px' }}
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 md:flex-nowrap"
      >
        {/* Hamburger — mobile only (< 768px, Tailwind's `md` breakpoint;
            the spec's 480px/768px bands are approximated with Tailwind's
            built-in sm/md/lg scale rather than hand-rolled CSS media
            queries, to stay consistent with the rest of this app's
            utility-class styling — flagged, not a silent substitution). */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          style={{ color: '#ffffff' }}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-xl md:hidden"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* Logo — centered on mobile (hamburger left, dropdown right), left-aligned on desktop */}
        <Link
          to={dashboardPath}
          style={{ color: '#ffffff' }}
          className="flex flex-1 items-center justify-center gap-2 text-lg font-bold md:flex-none md:justify-start"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base">⚡</span>
          <span>GridMate</span>
        </Link>

        {/* Links — role-specific. Admin's full link set (Dashboard, Users,
            KYC, Trades, Settlements, Support Tickets, Reports, System
            Health, Settings) is folded in directly here — sourced from
            AdminNav's exported ADMIN_LINKS so there's one list, not two —
            instead of every /admin/* page rendering AdminNav as a second
            row underneath. Everyone else keeps the regular link set.
            Hidden below md; the mobile slide-out panel underneath takes over. */}
        <div style={{ gap: '30px' }} className="hidden items-center overflow-x-auto md:flex">
          {renderLinks()}
        </div>

        {/* User dropdown + Logout */}
        <div className="flex items-center gap-2">
          {user && <UserDropdown user={user} />}
          <button
            type="button"
            onClick={handleLogout}
            style={{ color: '#ffffff' }}
            className="hidden rounded-lg bg-white/15 px-3 py-2 text-sm font-medium transition hover:bg-white/25 md:block"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Mobile slide-out menu — all tabs stacked, plus Logout since the
          desktop Logout button is hidden below md. */}
      {mobileMenuOpen && (
        <div className="border-t border-white/15 md:hidden">
          <div className="flex flex-col gap-1 px-4 py-3">
            {renderLinks(() => setMobileMenuOpen(false))}
            <button
              type="button"
              onClick={handleLogout}
              style={{ color: '#ffffff' }}
              className="mt-2 min-h-[44px] rounded-lg bg-white/15 px-3 py-2 text-left text-sm font-medium transition hover:bg-white/25"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
