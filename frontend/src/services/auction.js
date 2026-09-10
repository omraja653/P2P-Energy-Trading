import api from './api.js'

// Periodic double-auction venue (backend: routes/auction.js +
// jobs/auctionScheduler.js). Separate from services/advanced.js (the
// instant-match slot/bid venue) — different endpoints, different mechanics.

export async function placeAuctionOrder({ side, quantity, pricePerKwh }) {
  const { data } = await api.post('/auction/orders', { side, quantity, pricePerKwh })
  return data
}

// Anonymised order-book depth for the round currently collecting, plus
// `nextRoundInMs`.
export async function fetchAuctionBook() {
  const { data } = await api.get('/auction/orders')
  return data
}

export async function fetchMyAuctionOrders() {
  const { data } = await api.get('/auction/orders/mine')
  return data
}

export async function cancelAuctionOrder(id) {
  const { data } = await api.post(`/auction/orders/${id}/cancel`)
  return data
}

// Trades from rounds the caller took part in.
export async function fetchMyAuctionMatches() {
  const { data } = await api.get('/auction/matches')
  return data
}
