import api from './api.js'

// ---- Customer -------------------------------------------------------------

export async function createTicket({ subject, description, category, priority, chatbotInitiated, relatedChatMessage }) {
  const { data } = await api.post('/support/tickets', {
    subject,
    description,
    category,
    priority,
    chatbotInitiated,
    relatedChatMessage,
  })
  return data
}

export async function fetchMyTickets() {
  const { data } = await api.get('/support/tickets')
  return data
}

export async function fetchTicket(ticketId) {
  const { data } = await api.get(`/support/tickets/${ticketId}`)
  return data
}

export async function fetchTicketReplies(ticketId) {
  const { data } = await api.get(`/support/tickets/${ticketId}/replies`)
  return data
}

export async function addReply(ticketId, message) {
  const { data } = await api.post(`/support/tickets/${ticketId}/reply`, { message })
  return data
}

export async function closeTicket(ticketId) {
  const { data } = await api.patch(`/support/tickets/${ticketId}`, { status: 'Closed' })
  return data
}

// ---- Agent/admin ------------------------------------------------------------

export async function fetchAgentTickets({ status, priority, assignedTo, category, search } = {}) {
  const params = {}
  if (status) params.status = status
  if (priority) params.priority = priority
  if (assignedTo) params.assignedTo = assignedTo
  if (category) params.category = category
  if (search) params.search = search
  const { data } = await api.get('/support/admin/tickets', { params })
  return data
}

export async function assignTicketToMe(ticketId) {
  const { data } = await api.patch(`/support/admin/tickets/${ticketId}/assign`, {})
  return data
}

export async function setTicketStatus(ticketId, status) {
  const { data } = await api.patch(`/support/admin/tickets/${ticketId}/status`, { status })
  return data
}

export async function addAgentReply(ticketId, message) {
  const { data } = await api.post(`/support/admin/tickets/${ticketId}/reply`, { message })
  return data
}

export async function fetchDashboardMetrics() {
  const { data } = await api.get('/support/admin/dashboard')
  return data
}
