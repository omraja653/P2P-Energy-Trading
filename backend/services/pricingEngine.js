const BASE_PRICE_PER_KWH = 0.12;

/**
 * Simple supply/demand-adjusted pricing.
 * Placeholder for a real dynamic pricing model (Sprint 2).
 */
function calculatePrice({ availableSupplyKwh = 0, demandKwh = 0 } = {}) {
  if (availableSupplyKwh <= 0) return BASE_PRICE_PER_KWH;

  const demandRatio = demandKwh / availableSupplyKwh;
  const adjustment = Math.min(Math.max(demandRatio - 1, -0.5), 0.5);

  return Number((BASE_PRICE_PER_KWH * (1 + adjustment)).toFixed(4));
}

module.exports = { calculatePrice, BASE_PRICE_PER_KWH };
