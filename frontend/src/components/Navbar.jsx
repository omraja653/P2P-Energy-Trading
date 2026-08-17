import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

function dashboardPathFor(type) {
  if (type === 'prosumer') return '/prosumer-dashboard'
  if (type === 'admin') return '/admin'
  return '/consumer-dashboard'
}

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 bg-primary px-6 py-4 text-white">
      <Link to={dashboardPathFor(user?.type)} className="text-lg font-bold">
        GridMate
      </Link>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link to={dashboardPathFor(user?.type)} className="hover:underline">
          Dashboard
        </Link>
        <Link to="/marketplace" className="hover:underline">
          Marketplace
        </Link>
        <Link to="/trade-history" className="hover:underline">
          Trade History
        </Link>
        {user && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize">
            {user.firstName} · {user.type}
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="rounded bg-white/10 px-3 py-1 text-sm font-medium hover:bg-white/20"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}

export default Navbar
