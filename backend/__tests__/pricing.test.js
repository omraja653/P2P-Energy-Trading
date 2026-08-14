const { calculatePrice, BASE_PRICE_PER_KWH } = require('../services/pricingEngine');

describe('pricingEngine.calculatePrice', () => {
  it('returns the base price when there is no supply data', () => {
    expect(calculatePrice({ availableSupplyKwh: 0, demandKwh: 0 })).toBe(BASE_PRICE_PER_KWH);
  });

  it('increases price when demand exceeds supply', () => {
    const price = calculatePrice({ availableSupplyKwh: 10, demandKwh: 20 });
    expect(price).toBeGreaterThan(BASE_PRICE_PER_KWH);
  });

  it('decreases price when supply exceeds demand', () => {
    const price = calculatePrice({ availableSupplyKwh: 20, demandKwh: 5 });
    expect(price).toBeLessThan(BASE_PRICE_PER_KWH);
  });
});
