import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function dashboardPathFor(type) {
  if (type === 'prosumer') return '/prosumer-dashboard'
  if (type === 'admin') return '/admin'
  return '/consumer-dashboard'
}

function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showRegisterNotice, setShowRegisterNotice] = useState(false)

  // Already signed in (e.g. token still in localStorage) — skip the form.
  if (user) {
    return <Navigate to={dashboardPathFor(user.type)} replace />
  }

  function validate() {
    const errors = {}
    if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address'
    if (!password || password.length < 3) errors.password = 'Password must be at least 3 characters'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      const data = await login({ email, password })
      navigate(dashboardPathFor(data?.user?.type), { replace: true })
    } catch (err) {
      setFormError(err.response?.data?.error || 'Invalid email or password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-slate-900">GridMate</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in to your account</p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-none"
              placeholder="you@example.com"
            />
            {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-none"
              placeholder="••••••••"
            />
            {fieldErrors.password && <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>}
          </div>

          {formError && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>

          {submitting && <LoadingSpinner />}
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => setShowRegisterNotice(true)}
            className="text-blue-600 hover:underline"
          >
            Register
          </button>
        </p>
        {showRegisterNotice && (
          <p className="mt-2 text-center text-xs text-slate-400">
            Self-service registration isn&apos;t available yet — ask an admin to create your account.
          </p>
        )}

        <div className="mt-6 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-medium text-slate-600">Demo accounts (password: Password123)</p>
          <p>alice.prosumer@example.com · bob.consumer@example.com</p>
        </div>
      </div>
    </div>
  )
}

export default Login
