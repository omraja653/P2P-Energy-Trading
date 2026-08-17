import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AuthLayout from '../components/AuthLayout.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import RoleSelector from '../components/RoleSelector.jsx'
import { register, verifyEmailOtp, verifyMobileOtp, resendOtp } from '../services/auth.js'
import { EMAIL_REGEX, MOBILE_REGEX, passwordChecklist } from '../utils/validation.js'
import { dashboardPathFor } from '../utils/dashboardPath.js'

const RESEND_COOLDOWN_SECONDS = 30

// --- Step 1: registration form ---------------------------------------------

function RegistrationForm({ onRegistered }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const checklist = passwordChecklist(form.password)
  const passwordValid = checklist.every((rule) => rule.valid)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const errors = {}
    if (!form.firstName.trim()) errors.firstName = 'Required'
    if (!form.lastName.trim()) errors.lastName = 'Required'
    if (!EMAIL_REGEX.test(form.email)) errors.email = 'Enter a valid email address'
    // Mobile is optional — only validate format if they entered something.
    if (form.mobileNumber && !MOBILE_REGEX.test(form.mobileNumber)) {
      errors.mobileNumber = 'Include your country code, e.g. +918468810197'
    }
    if (!passwordValid) errors.password = 'Password does not meet all requirements'
    if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      const { firstName, lastName, email, mobileNumber, password } = form
      const data = await register({ firstName, lastName, email, mobileNumber: mobileNumber || undefined, password })
      onRegistered({
        registrationId: data.registrationId,
        email,
        mobileNumber,
        mobileCollected: data.mobileCollected,
        // Set when the account was created fine but the SMS couldn't be
        // delivered — surfaced on the email OTP screen so the user knows
        // why the mobile step is being skipped.
        warning: data.warning,
      })
    } catch (err) {
      setFormError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full rounded-lg bg-white p-8 shadow-2xl">
      <h1 className="text-center text-2xl font-bold text-slate-900">Create your GridMate account</h1>
      <p className="mt-1 text-center text-sm text-slate-500">Join the P2P energy marketplace</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">
              First name
            </label>
            <input
              id="firstName"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
            />
            {fieldErrors.firstName && <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">
              Last name
            </label>
            <input
              id="lastName"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
            />
            {fieldErrors.lastName && <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
            placeholder="you@example.com"
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="mobileNumber" className="block text-sm font-medium text-slate-700">
            Mobile number <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="mobileNumber"
            type="tel"
            autoComplete="tel"
            value={form.mobileNumber}
            onChange={(e) => update('mobileNumber', e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
            placeholder="+918468810197"
          />
          {fieldErrors.mobileNumber ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.mobileNumber}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Include your country code (e.g. +91 for India).</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
            placeholder="••••••••"
          />
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {checklist.map((rule) => (
              <li key={rule.label} className={rule.valid ? 'text-green-600' : 'text-slate-400'}>
                {rule.valid ? '✓' : '○'} {rule.label}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
            placeholder="••••••••"
          />
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {formError && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Creating account...' : 'Register'}
        </button>
        {submitting && <LoadingSpinner />}
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Login
        </Link>
      </p>
    </div>
  )
}

// --- Steps 2 & 3: OTP verification (shared UI, used for email then mobile) --

function OtpStep({ title, target, onVerify, onResend, onSkip, notice }) {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMessage, setResendMessage] = useState('')

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code')
      return
    }
    setSubmitting(true)
    try {
      await onVerify(otp)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError('')
    setResendMessage('')
    try {
      await onResend()
      setResendMessage('A new code has been sent.')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code')
    }
  }

  return (
    <div className="w-full rounded-lg bg-white p-8 shadow-2xl">
      <h1 className="text-center text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-center text-sm text-slate-500">
        Enter the 6-digit code sent to <span className="font-medium text-slate-700">{target}</span>
      </p>

      {notice && (
        <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">{notice}</p>
      )}

      <form onSubmit={handleVerify} noValidate className="mt-6 flex flex-col gap-4">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] focus:border-primary focus:outline-none"
          placeholder="------"
          autoFocus
        />

        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {resendMessage && <p className="text-center text-sm text-green-600">{resendMessage}</p>}

        <button
          type="submit"
          disabled={submitting || otp.length !== 6}
          className="rounded bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Verifying...' : `Verify ${title.includes('Email') ? 'Email' : 'Mobile'}`}
        </button>
        {submitting && <LoadingSpinner />}
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        Didn&apos;t get a code?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
        >
          {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
        </button>
      </p>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 block w-full text-center text-sm text-slate-400 hover:underline"
        >
          Skip for now
        </button>
      )}
    </div>
  )
}

// --- Wizard -------------------------------------------------------------------

function Register() {
  const { user, setSession } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('form')
  const [registration, setRegistration] = useState(null)

  // Already fully signed in (has a role) — nothing to do here.
  if (user && dashboardPathFor(user.type)) {
    return <Navigate to={dashboardPathFor(user.type)} replace />
  }

  return (
    <AuthLayout>
      {step === 'form' && (
        <RegistrationForm
          onRegistered={(reg) => {
            setRegistration(reg)
            setStep('email-otp')
          }}
        />
      )}

      {step === 'email-otp' && registration && (
        <OtpStep
          title="Verify your email"
          target={registration.email}
          onVerify={async (otp) => {
            // Email verification alone activates the account — the response
            // includes a real session (user + token). Persist it so the
            // rest of the wizard (optional mobile step, role selection) is
            // authenticated. Skip straight to role selection if no mobile
            // number was even collected — nothing to verify.
            const data = await verifyEmailOtp(registration.registrationId, otp)
            setSession(data)
            setStep(registration.mobileCollected ? 'mobile-otp' : 'role')
          }}
          onResend={() => resendOtp(registration.registrationId, 'email')}
          notice={registration.warning}
        />
      )}

      {step === 'mobile-otp' && registration && (
        <OtpStep
          title="Verify your mobile number"
          target={registration.mobileNumber}
          onVerify={async (otp) => {
            const data = await verifyMobileOtp(registration.registrationId, otp)
            setSession(data)
            setStep('role')
          }}
          onResend={() => resendOtp(registration.registrationId, 'mobile')}
          onSkip={() => setStep('role')}
        />
      )}

      {step === 'role' && (
        <RoleSelector
          onDone={(updatedUser) => navigate(dashboardPathFor(updatedUser.type) || '/login', { replace: true })}
        />
      )}
    </AuthLayout>
  )
}

export default Register
