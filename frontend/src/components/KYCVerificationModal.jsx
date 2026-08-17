import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { dashboardPathFor } from '../utils/dashboardPath.js'

// Placeholder — there's no self-service KYC flow (document upload, admin
// review, etc.) built yet, and no endpoint that sets kycVerified from the
// frontend. This honestly says so rather than faking a working flow; it's
// a dead-end for trading by design until real KYC is built — but it must
// NEVER trap the user with no way out. Most demo accounts have
// kycVerified: false, so this is what most people hit on Marketplace/Trade
// History; without an escape link they'd be stuck with no way to navigate
// anywhere else (and this overlay covers the navbar).
function KYCVerificationModal() {
  const { user } = useAuth()
  const backTo = dashboardPathFor(user?.type) || '/login'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900">Identity verification required</h2>
        <p className="mt-2 text-sm text-slate-500">
          KYC (Know Your Customer) verification is required before you can trade energy on GridMate.
          Self-service verification isn&apos;t available yet — contact an admin to have your account verified.
        </p>
        <Link
          to={backTo}
          className="mt-6 inline-block rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default KYCVerificationModal
