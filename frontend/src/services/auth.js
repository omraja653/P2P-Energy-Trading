import api from './api.js'

function storeSession(data) {
  if (data?.token) localStorage.setItem('token', data.token)
  return data
}

export async function login(credentials) {
  const { data } = await api.post('/auth/login-email-password', credentials)
  return storeSession(data)
}

export async function loginWithGoogle(idToken) {
  const { data } = await api.post('/auth/google', { idToken })
  return storeSession(data)
}

// payload: { email } or { mobileNumber } — whichever channel you're about
// to log in with. Only works for already-verified channels.
export async function requestLoginOtp(payload) {
  const { data } = await api.post('/auth/request-login-otp', payload)
  return data
}

export async function loginWithEmailOtp(email, otp) {
  const { data } = await api.post('/auth/login-email-otp', { email, otp })
  return storeSession(data)
}

export async function loginWithMobileOtp(mobileNumber, otp) {
  const { data } = await api.post('/auth/login-mobile-otp', { mobileNumber, otp })
  return storeSession(data)
}

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload)
  return data
}

export async function verifyEmailOtp(registrationId, otp) {
  // Email verification alone activates the account — the backend logs the
  // user in immediately (token present in the response).
  const { data } = await api.post('/auth/verify-email-otp', { registrationId, otp })
  return storeSession(data)
}

export async function verifyMobileOtp(registrationId, otp) {
  const { data } = await api.post('/auth/verify-mobile-otp', { registrationId, otp })
  return storeSession(data)
}

export async function resendOtp(registrationId, channel) {
  const { data } = await api.post('/auth/resend-otp', { registrationId, channel })
  return data
}

// For an already-authenticated user with no (verified) mobile number yet —
// Google sign-ins, or local users who skipped it at registration.
export async function requestMobileOtp(mobileNumber) {
  const { data } = await api.post('/auth/request-mobile-otp', { mobileNumber })
  return data
}

export async function requestPasswordReset(email) {
  const { data } = await api.post('/auth/forgot-password', { email })
  return data
}

export async function resetPassword(email, otp, newPassword) {
  // Logs the user in immediately on success (token present in the response).
  const { data } = await api.post('/auth/reset-password', { email, otp, newPassword })
  return storeSession(data)
}

export async function updateUserRole(type) {
  const { data } = await api.patch('/auth/role', { type })
  return storeSession(data)
}

export async function updateUserLocation(location) {
  const { data } = await api.patch('/auth/location', location)
  return storeSession(data)
}

export async function getMe() {
  const { data } = await api.get('/auth/me')
  return data
}

export function logout() {
  localStorage.removeItem('token')
}

export function getStoredUser() {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}
