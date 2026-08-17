import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { requestLoginOtp } from '../services/auth.js'
import GoogleSignInButton from './GoogleSignInButton.jsx'
import LoadingSpinner from './LoadingSpinner.jsx'

// --- OTP sub-flow shared by the Email + OTP and Mobile + OTP options --------

function OtpSubForm({ title, identifierLabel, identifierPlaceholder, identifierType, requestPayload, onVerify }) {
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('identifier') // 'identifier' | 'otp'
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  async function handleRequest(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await requestLoginOtp(requestPayload(identifier))
      setStep('otp')
      setResendCooldown(30)
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
      await onVerify(identifier, otp)
      // On success the modal closes right away (see caller) — no need to
      // reset `submitting` here.
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code')
      setSubmitting(false)
    }
  }

  return (
    <>
      <h2 className="mt-4 text-center text-xl font-bold text-slate-900">{title}</h2>

      {step === 'identifier' ? (
        <form onSubmit={handleRequest} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">{identifierLabel}</label>
            <input
              type={identifierType}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={identifierPlaceholder}
              autoFocus
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Send code'}
          </button>
          {submitting && <LoadingSpinner />}
        </form>
      ) : (
        <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
          <p className="text-center text-sm text-slate-500">
            Code sent to <span className="font-medium text-slate-700">{identifier}</span>
          </p>
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
          <button
            type="submit"
            disabled={submitting || otp.length !== 6}
            className="rounded bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Verifying...' : 'Login'}
          </button>
          <button
            type="button"
            onClick={handleRequest}
            disabled={resendCooldown > 0 || submitting}
            className="text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          >
            {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
          </button>
          {submitting && <LoadingSpinner />}
        </form>
      )}
    </>
  )
}

// --- Modal ---------------------------------------------------------------------

/**
 * "Try another way" modal — three alternative sign-in methods. Closes
 * itself on any successful login; Google's post-login mobile-verification
 * prompt (if needed) is handled by the parent Login page after this closes,
 * via `onGoogleSuccess`.
 */
function AlternativeLoginModal({ onClose, onGoogleSuccess }) {
  const { loginWithGoogle, loginWithEmailOtp, loginWithMobileOtp } = useAuth()
  const [view, setView] = useState('options') // 'options' | 'email-otp' | 'mobile-otp'
  const [googleError, setGoogleError] = useState('')
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  // Starts off-screen/transparent, flips true on mount so Tailwind's
  // transition utilities actually have a change to animate between.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  async function handleGoogleCredential(idToken) {
    setGoogleError('')
    setGoogleSubmitting(true)
    try {
      const data = await loginWithGoogle(idToken)
      onClose()
      onGoogleSuccess?.(data)
    } catch (err) {
      setGoogleError(err.response?.data?.error || 'Google sign-in failed')
    } finally {
      setGoogleSubmitting(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center px-4 transition-colors duration-200 ${
        entered ? 'bg-slate-950/80' : 'bg-slate-950/0'
      }`}
    >
      <div
        className={`w-full max-w-sm rounded-lg bg-white p-8 shadow-2xl transition-all duration-200 ${
          entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={view === 'options' ? onClose : () => setView('options')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← {view === 'options' ? 'Back to login' : 'Back'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {view === 'options' && (
          <>
            <h2 className="mt-4 text-center text-xl font-bold text-slate-900">Try another way</h2>

            <div className="mt-6 flex flex-col gap-3">
              {googleError && (
                <p className="rounded bg-red-50 px-3 py-2 text-center text-sm text-red-600" role="alert">
                  {googleError}
                </p>
              )}
              <div className="flex justify-center">
                <GoogleSignInButton onCredential={handleGoogleCredential} disabled={googleSubmitting} />
              </div>
              {googleSubmitting && <LoadingSpinner />}

              <button
                type="button"
                onClick={() => setView('email-otp')}
                className="rounded border border-slate-300 px-4 py-3 text-left hover:border-primary hover:bg-primary/5"
              >
                <span className="block font-semibold text-slate-900">Email + OTP</span>
                <span className="block text-sm text-slate-500">Get a one-time code by email</span>
              </button>

              <button
                type="button"
                onClick={() => setView('mobile-otp')}
                className="rounded border border-slate-300 px-4 py-3 text-left hover:border-primary hover:bg-primary/5"
              >
                <span className="block font-semibold text-slate-900">Mobile + OTP</span>
                <span className="block text-sm text-slate-500">Get a one-time code by SMS</span>
              </button>
            </div>
          </>
        )}

        {view === 'email-otp' && (
          <OtpSubForm
            title="Email + OTP"
            identifierLabel="Email"
            identifierPlaceholder="you@example.com"
            identifierType="email"
            requestPayload={(email) => ({ email })}
            onVerify={async (email, otp) => {
              await loginWithEmailOtp(email, otp)
              onClose()
            }}
          />
        )}

        {view === 'mobile-otp' && (
          <OtpSubForm
            title="Mobile + OTP"
            identifierLabel="Mobile number"
            identifierPlaceholder="+14155552671"
            identifierType="tel"
            requestPayload={(mobileNumber) => ({ mobileNumber })}
            onVerify={async (mobileNumber, otp) => {
              await loginWithMobileOtp(mobileNumber, otp)
              onClose()
            }}
          />
        )}
      </div>
    </div>
  )
}

export default AlternativeLoginModal
