import api from './api.js'

// Buys a whole listing's worth of energy. The backend matches the buyer
// against active listings server-side (lowest price first) and creates
// the resulting Trade document(s) — it derives seller/price itself, so
// the client only needs to say how much it wants and in which market.
export async function buyEnergy({ quantityKWh, tradingType }) {
  const { data } = await api.post('/trades', { quantityKWh, tradingType })
  return data // { trades: Trade[], unmatchedKwh }
}

// Returns every trade where the current user is buyer OR seller.
export async function fetchMyTrades() {
  const { data } = await api.get('/trades')
  return data
}

export async function fetchSettlements() {
  const { data } = await api.get('/settlements')
  return data
}
