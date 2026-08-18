import { useCallback, useState } from 'react'
import {
  login as loginRequest,
  loginWithGoogle as loginWithGoogleRequest,
  loginWithEmailOtp as loginWithEmailOtpRequest,
  loginWithMobileOtp as loginWithMobileOtpRequest,
  resetPassword as resetPasswordRequest,
  updateUserRole as updateUserRoleRequest,
  updateUserLocation as updateUserLocationRequest,
  logout as clearSession,
  getStoredUser,
} from '../services/auth.js'

export function useAuth() {
  const [user, setUser] = useState(getStoredUser)

  const applySession = useCallback((data) => {
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
    }
    return data
  }, [])

  const login = useCallback(async (credentials) => applySession(await loginRequest(credentials)), [
    applySession,
  ])

  const loginWithGoogle = useCallback(
    async (idToken) => applySession(await loginWithGoogleRequest(idToken)),
    [applySession]
  )

  const loginWithEmailOtp = useCallback(
    async (email, otp) => applySession(await loginWithEmailOtpRequest(email, otp)),
    [applySession]
  )

  const loginWithMobileOtp = useCallback(
    async (mobileNumber, otp) => applySession(await loginWithMobileOtpRequest(mobileNumber, otp)),
    [applySession]
  )

  const resetPassword = useCallback(
    async (email, otp, newPassword) => applySession(await resetPasswordRequest(email, otp, newPassword)),
    [applySession]
  )

  const updateUserRole = useCallback(
    async (type) => applySession(await updateUserRoleRequest(type)),
    [applySession]
  )

  const updateUserLocation = useCallback(
    async (location) => applySession(await updateUserLocationRequest(location)),
    [applySession]
  )

  // Lets a caller that already has a { user, token } payload (e.g. the
  // verify-email-otp / verify-mobile-otp responses, which log the user in
  // directly) persist it without a redundant extra API call.
  const setSession = useCallback((data) => applySession(data), [applySession])

  const logout = useCallback(() => {
    clearSession()
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return {
    user,
    login,
    loginWithGoogle,
    loginWithEmailOtp,
    loginWithMobileOtp,
    resetPassword,
    updateUserRole,
    updateUserLocation,
    setSession,
    logout,
    isAuthenticated: Boolean(user),
  }
}
