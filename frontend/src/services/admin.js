import api from './api.js'

// --- Users -------------------------------------------------------------------
export async function fetchAdminUsers(filters = {}) {
  const { data } = await api.get('/admin/users', { params: filters })
  return data
}
export async function fetchAdminUserDetail(id) {
  const { data } = await api.get(`/admin/users/${id}`)
  return data
}
export async function setUserStatus(id, status) {
  const { data } = await api.patch(`/admin/users/${id}/status`, { status })
  return data
}
export async function verifyUserEmail(id) {
  const { data } = await api.patch(`/admin/users/${id}/verify-email`)
  return data
}
export async function verifyUserMobile(id) {
  const { data } = await api.patch(`/admin/users/${id}/verify-mobile`)
  return data
}
export async function resendUserOtp(id, channel) {
  const { data } = await api.post(`/admin/users/${id}/send-otp`, { channel })
  return data
}
export async function deleteAdminUser(id) {
  const { data } = await api.delete(`/admin/users/${id}`)
  return data
}

// --- KYC -----------------------------------------------------------------
export async function fetchKycQueue(status) {
  const { data } = await api.get('/admin/kyc', { params: { status } })
  return data
}
export async function fetchKycDetail(id) {
  const { data } = await api.get(`/admin/kyc/${id}`)
  return data
}
export async function approveKyc(id, notes) {
  const { data } = await api.patch(`/admin/kyc/${id}/approve`, { notes })
  return data
}
export async function rejectKyc(id, reason) {
  const { data } = await api.patch(`/admin/kyc/${id}/reject`, { reason })
  return data
}
export async function requestKycResubmit(id, message) {
  const { data } = await api.post(`/admin/kyc/${id}/request-resubmit`, { message })
  return data
}

// --- Trades ----------------------------------------------------------------
export async function fetchAdminTrades(filters = {}) {
  const { data } = await api.get('/admin/trades', { params: filters })
  return data
}
export async function fetchAdminTradeDetail(id) {
  const { data } = await api.get(`/admin/trades/${id}`)
  return data
}
export async function disputeTrade(id, reason) {
  const { data } = await api.patch(`/admin/trades/${id}/dispute`, { reason })
  return data
}
export async function resolveTradeDispute(id, decision, notes) {
  const { data } = await api.patch(`/admin/trades/${id}/resolve`, { decision, notes })
  return data
}

// --- Settlements -------------------------------------------------------------
export async function fetchAdminSettlements(filters = {}) {
  const { data } = await api.get('/admin/settlements', { params: filters })
  return data
}
export async function fetchAdminSettlementDetail(id) {
  const { data } = await api.get(`/admin/settlements/${id}`)
  return data
}
export async function setSettlementStatus(id, status, blockchainTxHash) {
  const { data } = await api.patch(`/admin/settlements/${id}/status`, { status, blockchainTxHash })
  return data
}

// --- Metrics / analytics / logs -----------------------------------------------
export async function fetchAdminDashboard() {
  const { data } = await api.get('/admin/dashboard')
  return data
}
export async function fetchQuickActions() {
  const { data } = await api.get('/admin/quick-actions')
  return data
}
export async function fetchUserAnalytics(days = 30) {
  const { data } = await api.get('/admin/analytics/users', { params: { days } })
  return data
}
export async function fetchTradeAnalytics(days = 30) {
  const { data } = await api.get('/admin/analytics/trades', { params: { days } })
  return data
}
export async function fetchRevenueAnalytics() {
  const { data } = await api.get('/admin/analytics/revenue')
  return data
}
export async function fetchBlockchainAnalytics() {
  const { data } = await api.get('/admin/analytics/blockchain')
  return data
}
export async function fetchAdminLogs(limit = 50) {
  const { data } = await api.get('/admin/logs', { params: { limit } })
  return data
}

// --- Reports -----------------------------------------------------------------
export async function fetchRevenueReport() {
  const { data } = await api.get('/admin/reports/revenue')
  return data
}
export async function fetchComplianceReport() {
  const { data } = await api.get('/admin/reports/compliance')
  return data
}
export async function fetchDisputesReport() {
  const { data } = await api.get('/admin/reports/disputes')
  return data
}
export async function downloadRevenueCsv() {
  const { data } = await api.get('/admin/reports/export', { params: { type: 'revenue' }, responseType: 'blob' })
  return data
}

// --- System ------------------------------------------------------------------
export async function fetchSystemHealth() {
  const { data } = await api.get('/admin/system/health')
  return data
}
export async function sendBroadcast(subject, message) {
  const { data } = await api.post('/admin/system/broadcast', { subject, message })
  return data
}
export async function fetchBroadcasts() {
  const { data } = await api.get('/admin/system/broadcasts')
  return data
}
export async function fetchSystemSettings() {
  const { data } = await api.get('/admin/system/settings')
  return data
}
export async function updateSystemSettings(fields) {
  const { data } = await api.patch('/admin/system/settings', fields)
  return data
}
