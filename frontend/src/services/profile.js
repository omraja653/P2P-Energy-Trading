import api from './api.js'

export async function fetchProfile() {
  const { data } = await api.get('/profile')
  return data
}

export async function updateProfile(fields) {
  const { data } = await api.patch('/profile', fields)
  return data
}

export async function changePassword(oldPassword, newPassword) {
  const { data } = await api.patch('/profile/password', { oldPassword, newPassword })
  return data
}

// Starts the OTP flow — the number only takes effect once verified via the
// existing verifyMobileOtp(registrationId, otp) from services/auth.js.
export async function updateMobile(mobileNumber) {
  const { data } = await api.patch('/profile/mobile', { mobileNumber })
  return data
}

export async function fetchProfileTickets() {
  const { data } = await api.get('/profile/tickets')
  return data
}

export async function fetchProfileActivity() {
  const { data } = await api.get('/profile/activity')
  return data
}

export async function deleteAccount(password) {
  const { data } = await api.delete('/profile', { data: password ? { password } : {} })
  return data
}
