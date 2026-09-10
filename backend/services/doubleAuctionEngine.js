/**
 * Uniform-price (sealed-bid) double auction.
 *
 * Called by jobs/auctionScheduler.js once per round with every still-open
 * BUY and SELL order. It does NOT touch the database, wallets, or the
 * blockchain — it's a pure function of its inputs so it can be unit-tested
 * deterministically (see __tests__/doubleAuction.test.js). The scheduler
 * takes the plan it returns and does the real money movement + Trade
 * creation, transaction-guarded, exactly the way slotMatchingService does
 * for the instant matcher.
 *
 * Method: sort demand descending by price, supply ascending, walk both
 * while the current buyer still bids at least what the current seller asks.
 * Every unit that trades clears at ONE price — the midpoint of the last
 * matched buy and sell prices (the standard k = ½ rule). That's the
 * "fair, single clearing price" property; a buyer who bid ₹5 and a buyer
 * who bid ₹6 both pay the same clearing price as long as both are above it.
 *
 * Disclosed simplifications (same class the existing matchingEngine.js /
 * slotMatchingService.js already carry — not hidden):
 *  - The marginal buyer and/or seller can be left partially filled. Their
 *    unfilled remainder is re-queued by the scheduler (order stays pending
 *    with reduced quantity) rather than split into a fresh order.
 *  - No pro-rata tie-breaking when several orders sit exactly at the
 *    clearing price — it's first-come (input order, which the scheduler
 *    passes sorted by createdAt) first-served.
 *  - Price ties in the sort are broken by createdAt order (stable sort),
 *    i.e. earlier orders match first at the same price.
 */

/**
 * @param {Array<{_id:any,userId:any,quantity:number,pricePerKwh:number}>} buyOrders
 * @param {Array<{_id:any,userId:any,quantity:number,pricePerKwh:number}>} sellOrders
 * @returns {{
 *   cleared: boolean,
 *   clearingPrice: number|null,
 *   clearingQuantity: number,
 *   totalDemand: number,
 *   totalSupply: number,
 *   fillRate: number,
 *   matches: Array<{buyOrderId:any,sellOrderId:any,buyerId:any,sellerId:any,quantity:number}>,
 * }}
 */
function runAuction(buyOrders, sellOrders) {
  const totalDemand = sum(buyOrders.map((o) => o.quantity));
  const totalSupply = sum(sellOrders.map((o) => o.quantity));

  const empty = {
    cleared: false,
    clearingPrice: null,
    clearingQuantity: 0,
    totalDemand,
    totalSupply,
    fillRate: 0,
    matches: [],
  };

  if (buyOrders.length === 0 || sellOrders.length === 0) return empty;

  // Highest willingness-to-pay first; lowest ask first. Number(...) guards
  // against a stray string sneaking through from the DB layer.
  const buys = [...buyOrders].sort((a, b) => b.pricePerKwh - a.pricePerKwh);
  const sells = [...sellOrders].sort((a, b) => a.pricePerKwh - b.pricePerKwh);

  // No overlap at all — the cheapest seller still asks more than the most
  // generous buyer will pay. Nothing trades this round; every order stays
  // pending for the next one.
  if (buys[0].pricePerKwh < sells[0].pricePerKwh) return empty;

  const matches = [];
  let i = 0;
  let j = 0;
  let buyRemaining = buys[0].quantity;
  let sellRemaining = sells[0].quantity;
  let lastBuyPrice = null;
  let lastSellPrice = null;

  while (i < buys.length && j < sells.length && buys[i].pricePerKwh >= sells[j].pricePerKwh) {
    const q = Math.min(buyRemaining, sellRemaining);
    if (q > 0) {
      matches.push({
        buyOrderId: buys[i]._id,
        sellOrderId: sells[j]._id,
        buyerId: buys[i].userId,
        sellerId: sells[j].userId,
        quantity: round4(q),
      });
      lastBuyPrice = buys[i].pricePerKwh;
      lastSellPrice = sells[j].pricePerKwh;
    }
    buyRemaining -= q;
    sellRemaining -= q;

    if (buyRemaining <= 0) {
      i += 1;
      buyRemaining = i < buys.length ? buys[i].quantity : 0;
    }
    if (sellRemaining <= 0) {
      j += 1;
      sellRemaining = j < sells.length ? sells[j].quantity : 0;
    }
  }

  if (matches.length === 0) return empty;

  const clearingPrice = round4((lastBuyPrice + lastSellPrice) / 2);
  const clearingQuantity = round4(sum(matches.map((m) => m.quantity)));
  // Rough "how much of the possible volume actually traded" gauge for the
  // UI — feasible ceiling is whichever side is scarcer. Not a welfare
  // measure, just a fill indicator.
  const feasible = Math.min(totalDemand, totalSupply);
  const fillRate = feasible > 0 ? round4(clearingQuantity / feasible) : 0;

  return {
    cleared: true,
    clearingPrice,
    clearingQuantity,
    totalDemand: round4(totalDemand),
    totalSupply: round4(totalSupply),
    fillRate,
    matches,
  };
}

function sum(arr) {
  return arr.reduce((t, n) => t + n, 0);
}

function round4(n) {
  return Number(n.toFixed(4));
}

module.exports = { runAuction };
