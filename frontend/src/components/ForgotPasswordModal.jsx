import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { requestPasswordReset } from '../services/auth.js'
import { EMAIL_REGEX, passwordChecklist } from '../utils/validation.js'
import LoadingSpinner from './LoadingSpinner.jsx'

/**
 * "Forgot Password?" modal — email, then a 6-digit code + new password.
 * Closes and logs the user straight in on success (reset-password returns
 * a real session, same as every other identity-confirming action in this
 * app: email/mobile verification, role selection).
 */
function ForgotPasswordModal({ onClose, onDone }) {
  const { resetPassword } = useAuth()
  const [step, setStep] = useState('email') // 'email' | 'reset'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const checklist = passwordChecklist(newPassword)
  const passwordValid = checklist.every((rule) => rule.valid)

  async function handleRequestCode(e) {
    e.preventDefault()
    setError('')
    if (!EMAIL_REGEX.test(email)) {
      setError('Enter a valid email address')
      return
    }
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setStep('reset')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send a reset code')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code')
      return
    }
    if (!passwordValid) {
      setError('Password does not meet all requirements')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const data = await resetPassword(email, otp, newPassword)
      onDone(data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={step === 'email' ? onClose : () => setStep('email')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← {step === 'email' ? 'Back to login' : 'Back'}
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {step === 'email' && (
          <>
            <h2 className="mt-4 text-center text-xl font-bold text-slate-900">Reset your password</h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              We&apos;ll email you a 6-digit code to confirm it&apos;s you.
            </p>

            <form onSubmit={handleRequestCode} noValidate className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-gradient-to-r from-green-500 to-blue-600 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send reset code'}
              </button>
              {submitting && <LoadingSpinner />}
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <h2 className="mt-4 text-center text-xl font-bold text-slate-900">Enter code & new password</h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              Code sent to <span className="font-medium text-slate-700">{email}</span>
            </p>

            <form onSubmit={handleReset} noValidate className="mt-6 flex flex-col gap-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                placeholder="------"
                autoFocus
              />

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
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
                <label htmlFor="confirm-new-password" className="block text-sm font-medium text-slate-700">
                  Confirm new password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="rounded-lg bg-gradient-to-r from-green-500 to-blue-600 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Resetting...' : 'Reset password'}
              </button>
              {submitting && <LoadingSpinner />}
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ForgotPasswordModal
