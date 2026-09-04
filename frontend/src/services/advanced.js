import api from './api.js'

export async function fetchForecast(date) {
  const { data } = await api.get(`/forecasting/${date}`)
  return data
}

export async function placeBid({ hour, date, bidPrice, bidQuantity, bidType }) {
  const { data } = await api.post('/slots/bid', { hour, date, bidPrice, bidQuantity, bidType })
  return data
}

export async function fetchSlotsForDate(date, bidType) {
  const { data } = await api.get(`/slots/date/${date}`, { params: bidType ? { bidType } : undefined })
  return data
}

export async function fetchMySlots(date) {
  const { data } = await api.get(`/slots/mine/${date}`)
  return data
}

// Full-day bid — no hour, just a trading type (intraday/dayahead). Matched
// against any opposing bid for the same day+type, not a specific hour.
export async function placeFullDayBid({ tradingType, bidQuantity, bidPrice, bidType }) {
  const { data } = await api.post('/slots/bid', { tradingType, bidQuantity, bidPrice, bidType })
  return data
}

export async function fetchActiveBids() {
  const { data } = await api.get('/slots/mine/active')
  return data
}

export async function cancelBid(id) {
  const { data } = await api.post(`/slots/${id}/cancel`)
  return data
}

export async function fetchRevenue(month) {
  const { data } = await api.get(`/revenue/${month}`)
  return data
}
