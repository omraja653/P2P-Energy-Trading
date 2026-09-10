const { runAuction } = require('../services/doubleAuctionEngine');

// Pure function, no DB — plain unit tests.
const buy = (id, userId, quantity, pricePerKwh) => ({ _id: id, userId, quantity, pricePerKwh });
const sell = buy;

describe('doubleAuctionEngine.runAuction', () => {
  it('returns no clearing when one side is empty', () => {
    const r = runAuction([buy('b1', 'u1', 10, 5)], []);
    expect(r.cleared).toBe(false);
    expect(r.matches).toHaveLength(0);
  });

  it('returns no clearing when the best bid is below the lowest ask', () => {
    const r = runAuction([buy('b1', 'u1', 10, 3)], [sell('s1', 'u2', 10, 4)]);
    expect(r.cleared).toBe(false);
  });

  it('clears at the midpoint of the marginal matched pair (k = 1/2 rule)', () => {
    const r = runAuction([buy('b1', 'u1', 10, 5)], [sell('s1', 'u2', 10, 4)]);
    expect(r.cleared).toBe(true);
    expect(r.clearingPrice).toBe(4.5);
    expect(r.clearingQuantity).toBe(10);
    expect(r.matches).toHaveLength(1);
  });

  it('gives every matched order the SAME clearing price regardless of its own bid', () => {
    // Two buyers (₹6 and ₹5), two sellers (₹3 and ₹4), 10 kWh each.
    const buys = [buy('b1', 'ub1', 10, 6), buy('b2', 'ub2', 10, 5)];
    const sells = [sell('s1', 'us1', 10, 3), sell('s2', 'us2', 10, 4)];
    const r = runAuction(buys, sells);
    expect(r.cleared).toBe(true);
    // Marginal pair is buyer ₹5 vs seller ₹4 -> midpoint 4.5.
    expect(r.clearingPrice).toBe(4.5);
    expect(r.clearingQuantity).toBe(20);
    expect(r.matches).toHaveLength(2);
  });

  it('excludes orders on the wrong side of the clearing price', () => {
    // Buyer ₹10/10kWh, sellers: ₹4/10kWh (in) and ₹9/10kWh (out).
    const r = runAuction([buy('b1', 'u1', 10, 10)], [sell('s1', 'u2', 10, 4), sell('s2', 'u3', 10, 9)]);
    expect(r.clearingQuantity).toBe(10);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].sellOrderId).toBe('s1');
  });

  it('partially fills the marginal order', () => {
    const r = runAuction([buy('b1', 'u1', 15, 5)], [sell('s1', 'u2', 10, 4)]);
    expect(r.clearingQuantity).toBe(10); // limited by supply
    expect(r.matches[0].quantity).toBe(10);
  });

  it('does not divide by zero on the fill-rate metric', () => {
    const r = runAuction([buy('b1', 'u1', 10, 5)], [sell('s1', 'u2', 10, 5)]);
    expect(Number.isFinite(r.fillRate)).toBe(true);
    expect(r.fillRate).toBe(1);
  });

  it('does not mutate the caller\'s arrays', () => {
    const buys = [buy('b1', 'u1', 10, 3), buy('b2', 'u2', 10, 9)];
    const before = buys.map((b) => b._id).join(',');
    runAuction(buys, [sell('s1', 'u3', 10, 4)]);
    expect(buys.map((b) => b._id).join(',')).toBe(before);
  });
});
