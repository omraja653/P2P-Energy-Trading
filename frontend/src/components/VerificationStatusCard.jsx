import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import MobileVerificationModal from './MobileVerificationModal.jsx'
import KYCVerificationModal from './KYCVerificationModal.jsx'

function StatusRow({ label, verified, actionLabel, onAction, note }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {note && <p className="text-xs text-slate-400">{note}</p>}
      </div>
      <div className="flex items-center gap-3">
        {verified ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-green">✓ Verified</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-orange-500">⚠ Unverified</span>
            {onAction && (
              <button
                type="button"
                onClick={onAction}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {actionLabel}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// `user` here is the live profile object (from GET /profile), not the
// possibly-stale localStorage session user.
function VerificationStatusCard({ user, onRefresh }) {
  const { setSession } = useAuth()
  const [showMobileModal, setShowMobileModal] = useState(false)
  const [showKycModal, setShowKycModal] = useState(false)

  const tradingReady = user.mobileVerified && user.kycVerified
  const missing = [!user.mobileVerified && 'mobile verification', !user.kycVerified && 'KYC verification'].filter(Boolean)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Email is guaranteed verified for any logged-in account — email
          verification is what activates the account in the first place, so
          there's no unverified state to show here for a real session. */}
      <StatusRow label="Email" verified={user.emailVerified} note={user.email} />
      <StatusRow
        label="Mobile Number"
        verified={user.mobileVerified}
        actionLabel="Verify Now"
        note={user.mobileNumber || 'No number on file'}
        onAction={() => setShowMobileModal(true)}
      />
      <StatusRow
        label="KYC (Identity Verification)"
        verified={user.kycVerified}
        actionLabel="Start KYC"
        onAction={() => setShowKycModal(true)}
      />

      <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${tradingReady ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
        {tradingReady ? (
          <span>✓ Trading access unlocked — all checks pass.</span>
        ) : (
          <span>⚠ Trading is blocked until you complete: {missing.join(' and ')}.</span>
        )}
      </div>

      {showMobileModal && (
        <MobileVerificationModal
          onSkip={() => setShowMobileModal(false)}
          onDone={(updatedUser) => {
            setSession({ user: updatedUser })
            setShowMobileModal(false)
            onRefresh?.()
          }}
        />
      )}
      {showKycModal && <KYCVerificationModal onClose={() => setShowKycModal(false)} />}
    </div>
  )
}

export default VerificationStatusCard
