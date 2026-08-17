/**
 * Naive first-fit matcher: pairs a buy request against active listings
 * ordered by lowest price first. Placeholder for a real order-book matcher.
 */
function matchListings(listings, requestedKwh) {
  const sorted = [...listings]
    .filter((listing) => listing.status === 'active')
    .sort((a, b) => a.pricePerKwh - b.pricePerKwh);

  const matches = [];
  let remaining = requestedKwh;

  for (const listing of sorted) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, listing.quantityKWh);
    matches.push({ listing, amount });
    remaining -= amount;
  }

  return { matches, unmatchedKwh: Math.max(remaining, 0) };
}

module.exports = { matchListings };
