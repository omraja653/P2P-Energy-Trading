import { Navigate, Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Chat from './Chat.jsx'
import { useAuth } from '../hooks/useAuth.js'

// Gates every nested route behind a logged-in user (checked via the token
// useAuth restores from localStorage) and wraps them in the shared Navbar.
function ProtectedRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <Outlet />
      <Chat />
    </div>
  )
}

export default ProtectedRoute
