import api from './api.js'

export async function fetchUnseenNotifications() {
  const { data } = await api.get('/notifications', { params: { unseen: true } })
  return data
}

// All recent notifications (seen or not) — used for the profile dropdown's
// inline mini-list, as opposed to the floating popup which only cares about
// unseen ones.
export async function fetchRecentNotifications() {
  const { data } = await api.get('/notifications')
  return data
}

export async function markNotificationSeen(id) {
  const { data } = await api.patch(`/notifications/${id}/seen`)
  return data
}
