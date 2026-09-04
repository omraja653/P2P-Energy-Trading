const { Trade } = require('../models');

// Mirrors the "this month" savings/earnings math already used in
// routes/chat.js's buildUserContext, rather than inventing a different
// formula — same ₹0.15/kWh grid-retail comparison price for consumer
// savings. Counts 'verified' and 'settled' trades (energy actually
// delivered), same statuses chat.js counts.
const GRID_PRICE_PER_KWH = 0.15;
const REALIZED_STATUSES = ['verified', 'settled'];

// Computed fresh on every call rather than cached in a model — this app's
// Trade collection is small enough that re-aggregating per request is
// cheap, and a cached RevenueRecord would just be one more place for the
// numbers to go stale against the real trades.
async function getRevenue(userId, userType, month) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const idField = userType === 'prosumer' ? 'sellerId' : 'buyerId';
  const [trades, pendingTrades] = await Promise.all([
    Trade.find({
      [idField]: userId,
      status: { $in: REALIZED_STATUSES },
      createdAt: { $gte: start, $lt: end },
    }).sort({ createdAt: 1 }),
    // Matched but not yet meter-verified — not counted as realized revenue
    // yet, surfaced separately as "Pending" (prosumer) on the dashboard.
    Trade.find({ [idField]: userId, status: 'matched', createdAt: { $gte: start, $lt: end } }),
  ]);

  const dailyMap = new Map();
  const hourlyMap = new Map();
  let totalAmount = 0;
  let totalUnits = 0;
  let totalSpent = 0; // consumer only — gross amount actually paid, not the savings figure

  for (const trade of trades) {
    const dateKey = trade.createdAt.toISOString().slice(0, 10);
    const hourKey = trade.createdAt.getUTCHours();
    // Prosumer: gross trade value (pre-fee — the real net payout after
    // platform/grid fees lives on the linked Settlement, not duplicated
    // here). Consumer: what they'd have paid at grid retail minus what
    // they actually paid.
    const amount =
      userType === 'prosumer' ? trade.totalAmount : trade.quantityKWh * GRID_PRICE_PER_KWH - trade.totalAmount;
    if (userType === 'consumer') totalSpent += trade.totalAmount;

    if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, { date: dateKey, amount: 0, units: 0, trades: 0 });
    if (!hourlyMap.has(hourKey)) hourlyMap.set(hourKey, { hour: hourKey, amount: 0, units: 0, trades: 0 });

    const day = dailyMap.get(dateKey);
    day.amount += amount;
    day.units += trade.quantityKWh;
    day.trades += 1;

    const hourRow = hourlyMap.get(hourKey);
    hourRow.amount += amount;
    hourRow.units += trade.quantityKWh;
    hourRow.trades += 1;

    totalAmount += amount;
    totalUnits += trade.quantityKWh;
  }

  const pendingAmount = pendingTrades.reduce((sum, t) => sum + t.totalAmount, 0);

  const dailyBreakdown = [...dailyMap.values()]
    .map((d) => ({ ...d, amount: Number(d.amount.toFixed(2)), units: Number(d.units.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const hourlyBreakdown = [...hourlyMap.values()]
    .map((h) => ({ ...h, amount: Number(h.amount.toFixed(2)), units: Number(h.units.toFixed(2)) }))
    .sort((a, b) => a.hour - b.hour);

  const bestDay = dailyBreakdown.length ? dailyBreakdown.reduce((a, b) => (b.amount > a.amount ? b : a)).date : null;
  const bestHour = hourlyBreakdown.length ? hourlyBreakdown.reduce((a, b) => (b.amount > a.amount ? b : a)).hour : null;

  // "Forecast": a flat +10% extrapolation of this month's total — clearly
  // not a trend model (no prior-months history is even queried). Framed
  // honestly in the UI as a rough projection, not a prediction.
  const nextMonthEarnings = Number((totalAmount * 1.1).toFixed(2));
  const trend = totalAmount > 0 ? 'up' : totalAmount < 0 ? 'down' : 'stable';

  return {
    userId,
    userType,
    month,
    dailyBreakdown,
    hourlyBreakdown,
    totalEarnings: Number(totalAmount.toFixed(2)),
    totalUnits: Number(totalUnits.toFixed(2)),
    totalTrades: trades.length,
    // Prosumer: trades matched this month but not yet meter-verified.
    // Consumer: gross amount actually paid this month (distinct from
    // totalEarnings, which for a consumer is the *savings* figure).
    pending: userType === 'prosumer' ? Number(pendingAmount.toFixed(2)) : undefined,
    totalSpent: userType === 'consumer' ? Number(totalSpent.toFixed(2)) : undefined,
    bestHour,
    bestDay,
    forecast: { nextMonthEarnings, trend },
  };
}

/**
 * All-time balance — the read-only Wallet view. Deliberately not a
 * withdrawal system: no bank account storage, no payout trigger, just the
 * same real-trade math as getRevenue() with no date bound, plus a
 * "pending" figure for prosumers (trades matched but not yet meter-verified
 * — i.e. not even counted as realized revenue yet, let alone settled).
 */
async function getLifetimeSummary(userId, userType) {
  const idField = userType === 'prosumer' ? 'sellerId' : 'buyerId';

  const [realizedTrades, pendingTrades] = await Promise.all([
    Trade.find({ [idField]: userId, status: { $in: REALIZED_STATUSES } }),
    Trade.find({ [idField]: userId, status: 'matched' }),
  ]);

  let totalAmount = 0; // earnings (prosumer) or savings vs grid (consumer)
  let totalSpent = 0; // consumer only — what they actually paid
  let totalUnits = 0;
  for (const trade of realizedTrades) {
    if (userType === 'prosumer') {
      totalAmount += trade.totalAmount;
    } else {
      totalAmount += trade.quantityKWh * GRID_PRICE_PER_KWH - trade.totalAmount;
      totalSpent += trade.totalAmount;
    }
    totalUnits += trade.quantityKWh;
  }

  const pendingAmount = pendingTrades.reduce((sum, t) => sum + t.totalAmount, 0);

  return {
    userType,
    // Prosumer: lifetime gross earnings (pre-fee, same convention as
    // getRevenue). Consumer: lifetime savings vs grid retail.
    balance: Number(totalAmount.toFixed(2)),
    pending: Number(pendingAmount.toFixed(2)),
    totalSpent: userType === 'consumer' ? Number(totalSpent.toFixed(2)) : undefined,
    totalUnits: Number(totalUnits.toFixed(2)),
    totalTrades: realizedTrades.length,
  };
}

module.exports = { getRevenue, getLifetimeSummary };
