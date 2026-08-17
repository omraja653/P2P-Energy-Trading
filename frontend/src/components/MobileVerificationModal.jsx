import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { requestMobileOtp, verifyMobileOtp } from '../services/auth.js'
import { MOBILE_REGEX } from '../utils/validation.js'
import { dashboardPathFor } from '../utils/dashboardPath.js'
import LoadingSpinner from './LoadingSpinner.jsx'

/**
 * Lets an already-authenticated user (Google sign-in with no mobile on
 * file, or a local user who skipped it at registration) add and verify a
 * mobile number. `onSkip` is optional — pass it only where skipping is
 * actually allowed (e.g. right after Google login); VerificationGate
 * (gating trading) omits it, making this step mandatory there.
 *
 * "Back to Dashboard" (below) is always shown regardless of `onSkip` — it's
 * a plain exit, not a skip: it leaves the gated page without marking mobile
 * as verified. Without it, VerificationGate's usage (no onSkip) traps the
 * user with no way to navigate anywhere else in the app.
 */
function MobileVerificationModal({ onDone, onSkip }) {
  const { user, setSession } = useAuth()
  const backTo = dashboardPathFor(user?.type) || '/login'
  const [step, setStep] = useState('number') // 'number' | 'otp'
  const [mobileNumber, setMobileNumber] = useState('')
  const [registrationId, setRegistrationId] = useState(null)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleRequestOtp(e) {
    e.preventDefault()
    setError('')
    if (!MOBILE_REGEX.test(mobileNumber)) {
      setError('Use format +14155552671')
      return
    }
    setSubmitting(true)
    try {
      const data = await requestMobileOtp(mobileNumber)
      setRegistrationId(data.registrationId)
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send code')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code')
      return
    }
    setSubmitting(true)
    try {
      const data = await verifyMobileOtp(registrationId, otp)
      setSession(data)
      onDone(data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-2xl">
        <h2 className="text-center text-xl font-bold text-slate-900">Verify your mobile number</h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          {onSkip ? 'Add a mobile number for OTP login and faster trading.' : 'Required before you can trade on GridMate.'}
        </p>

        {step === 'number' && (
          <form onSubmit={handleRequestOtp} className="mt-6 flex flex-col gap-3">
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+14155552671"
              className="rounded border border-slate-300 px-3 py-2 text-center focus:border-primary focus:outline-none"
              autoFocus
            />
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send code'}
            </button>
            {submitting && <LoadingSpinner />}
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-3">
            <p className="text-center text-xs text-slate-500">
              Code sent to <span className="font-medium text-slate-700">{mobileNumber}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="rounded border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] focus:border-primary focus:outline-none"
              placeholder="------"
              autoFocus
            />
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              className="rounded bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Verifying...' : 'Verify Mobile'}
            </button>
            {submitting && <LoadingSpinner />}
          </form>
        )}

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 block w-full text-center text-sm text-slate-400 hover:underline"
          >
            Skip for now
          </button>
        )}

        <Link
          to={backTo}
          className="mt-3 block text-center text-sm font-medium text-slate-400 hover:text-slate-600 hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default MobileVerificationModal
