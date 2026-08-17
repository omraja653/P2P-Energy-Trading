const { matchListings } = require('../services/matchingEngine');

describe('matchingEngine.matchListings', () => {
  const listings = [
    { status: 'active', pricePerKwh: 0.15, quantityKWh: 5 },
    { status: 'active', pricePerKwh: 0.1, quantityKWh: 3 },
    { status: 'matched', pricePerKwh: 0.05, quantityKWh: 10 },
  ];

  it('prefers lower-priced listings first', () => {
    const { matches } = matchListings(listings, 3);
    expect(matches[0].listing.pricePerKwh).toBe(0.1);
  });

  it('ignores listings that are not active', () => {
    const { matches } = matchListings(listings, 100);
    expect(matches.every((m) => m.listing.status === 'active')).toBe(true);
  });

  it('reports unmatched demand when supply runs out', () => {
    const { unmatchedKwh } = matchListings(listings, 100);
    expect(unmatchedKwh).toBeGreaterThan(0);
  });
});
