import api from './api.js'

export async function fetchAdminStats() {
  const { data } = await api.get('/admin/stats')
  return data
}
