import { useState } from 'react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import RoleSelector from '../components/RoleSelector.jsx'
import MobileVerificationModal from '../components/MobileVerificationModal.jsx'
import AlternativeLoginModal from '../components/AlternativeLoginModal.jsx'
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx'
import { EMAIL_REGEX } from '../utils/validation.js'
import { dashboardPathFor } from '../utils/dashboardPath.js'

const HERO_IMAGE = '/loginpage.png'

// --- Brand mark -------------------------------------------------------------

function BrandMark() {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden="true">
          <ellipse
            cx="32"
            cy="32"
            rx="27"
            ry="13"
            fill="none"
            stroke="#2d6cdf"
            strokeWidth="2.5"
            transform="rotate(-30 32 32)"
          />
          <circle cx="9" cy="43" r="4.5" fill="#2d6cdf" />
          <circle cx="55" cy="21" r="4.5" fill="#2d6cdf" />
          <path
            d="M34 10c9 5 13 13 11 22-1.6 7.2-7 12.5-14 14 1-9 2.5-15 6-21-4.6 3.6-8 8-10.6 13.4C24 30 27 17 34 10z"
            fill="#22c55e"
          />
          <path d="M31 24c-3.4 6-5 12-5.6 21" stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path
            d="M30 26l-7 12h8l-9 14"
            stroke="#16a34a"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="text-[18px] font-extrabold leading-none tracking-tight sm:text-[20px]">
          <span className="text-[#1abf87]">GridMate</span> <span className="text-[#1abf87]">P2P</span>{' '}
          <span className="text-slate-800">Energy</span>
        </span>
      </div>
      <p className="mt-1.5 text-[10px] font-semibold tracking-[0.32em] text-slate-500">TRADING PLATFORM</p>
    </div>
  )
}

// --- Field icons ------------------------------------------------------------

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m4 4 16 16" strokeLinecap="round" />}
    </svg>
  )
}

// --- Page -------------------------------------------------------------------

function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [showAltModal, setShowAltModal] = useState(false)
  // Only ever set true right after a Google login response says so — a
  // plain page load/refresh never shows this, so existing local users who
  // skipped mobile at registration aren't nagged every time they visit here.
  const [showGoogleMobilePrompt, setShowGoogleMobilePrompt] = useState(false)

  // Already signed in (fresh login, Google sign-in, or a token already in
  // localStorage): route to role selection if typeless, then the Google
  // mobile prompt if flagged, then finally the dashboard.
  if (user) {
    const path = dashboardPathFor(user.type)
    if (!path) {
      return <RoleSelector onDone={() => {}} />
    }
    if (showGoogleMobilePrompt) {
      return (
        <MobileVerificationModal
          onDone={() => navigate(path, { replace: true })}
          onSkip={() => navigate(path, { replace: true })}
        />
      )
    }
    return <Navigate to={path} replace />
  }

  function validate() {
    const errors = {}
    if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address'
    if (!password) errors.password = 'Password is required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      await login({ email, password })
      // Re-render picks up the new `user` from useAuth and the branch
      // above handles routing to the dashboard or RoleSelector.
    } catch (err) {
      setFormError(err.response?.data?.error || 'Invalid email or password')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-[#edf3f6] py-3 pl-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/15'

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#edf4f1] text-slate-900 lg:flex-row">
      <aside className="flex w-full items-center justify-center px-4 py-6 sm:px-6 lg:w-[35%] lg:justify-end lg:px-6">
        <div className="w-full max-w-[500px] rounded-[30px] bg-white px-5 py-5 shadow-[0_18px_42px_rgba(15,23,42,0.06)] lg:p-6">
          <BrandMark />

          <h1 className="mt-8 text-[30px] font-black leading-none tracking-[-0.06em] text-slate-900">Welcome Back</h1>
          <p className="mt-3 text-[15px] text-slate-500">Login to continue your energy trading journey</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-[15px] font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} pr-3`}
                  placeholder="Enter your email"
                />
              </div>
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-[15px] font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600"
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}

              <div className="mt-1 text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[13px] font-medium text-[#1abf87] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {formError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 rounded-xl bg-gradient-to-r from-[#2fd57d] via-[#2ac6a7] to-[#2d7ae6] py-3 text-base font-semibold text-white shadow-[0_8px_18px_rgba(34,197,94,0.24)] transition hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Login'}
            </button>
            {submitting && <LoadingSpinner />}
          </form>

          <button
            type="button"
            onClick={() => setShowAltModal(true)}
            className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-700 transition hover:border-green-500 hover:bg-green-50/50 hover:text-green-700"
          >
            Try another way
          </button>

          <p className="mt-4 text-center text-[14px] text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-[#1abf87] hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </aside>

      <div className="flex h-[32vh] w-full lg:h-full lg:w-[65%]">
        <img
          src={HERO_IMAGE}
          alt="Renewable energy community"
          className="h-full w-full object-contain object-center bg-[#eaf3f0] lg:object-cover"
        />
      </div>

      {showAltModal && (
        <AlternativeLoginModal
          onClose={() => setShowAltModal(false)}
          onGoogleSuccess={(data) => {
            if (data.requiresMobileVerification) setShowGoogleMobilePrompt(true)
          }}
        />
      )}

      {showForgotModal && (
        <ForgotPasswordModal
          onClose={() => setShowForgotModal(false)}
          onDone={() => {
            // resetPassword already logged the user in (useAuth's `user`
            // state updates on success) — closing the modal lets the
            // top-of-component branch take over and route to the dashboard
            // or RoleSelector, same pattern as every other login path here.
            setShowForgotModal(false)
          }}
        />
      )}
    </div>
  )
}

export default Login
