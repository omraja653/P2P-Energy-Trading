import api from './api.js'

export async function fetchDashboard() {
  const { data } = await api.get('/dashboard')
  return data
}

export async function fetchWallet() {
  const { data } = await api.get('/wallet')
  return data
}

export async function createTopUpOrder(amount) {
  const { data } = await api.post('/wallet/add-balance', { amount })
  return data
}

export async function verifyTopUp({ orderId, paymentId, signature }) {
  const { data } = await api.post('/wallet/verify-topup', { orderId, paymentId, signature })
  return data
}
