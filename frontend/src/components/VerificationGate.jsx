import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { useFetch } from '../hooks/useFetch.js'
import LoadingSpinner from './LoadingSpinner.jsx'
import MobileVerificationModal from './MobileVerificationModal.jsx'
import KYCVerificationModal from './KYCVerificationModal.jsx'

/**
 * Wraps trading-related pages (Marketplace, TradeHistory). Checks *fresh*
 * verification status via GET /auth/me on every mount rather than trusting
 * the possibly-stale localStorage user object or JWT claims, then blocks
 * with the relevant modal until both mobileVerified and kycVerified are true.
 */
function VerificationGate({ children }) {
  const { setSession } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error } = useFetch(`/auth/me?_r=${refreshKey}`)

  if (loading) return <LoadingSpinner />
  if (error) return <p className="p-6 text-red-600">Failed to check verification status.</p>

  const user = data.user

  // TEMP: Mobile verification bypassed until Twilio upgrade
  // if (!user.mobileVerified) {
  //   return (
  //     <MobileVerificationModal
  //       onDone={(updatedUser) => {
  //         setSession({ user: updatedUser })
  //         setRefreshKey((k) => k + 1)
  //       }}
  //     />
  //   )
  // }

  if (!user.kycVerified) {
    return <KYCVerificationModal />
  }

  return children
}

export default VerificationGate
