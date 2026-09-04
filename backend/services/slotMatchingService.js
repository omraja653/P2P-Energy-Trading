const { TradingSlot, Trade, User } = require('../models');
const { notifyMatch } = require('./notificationService');
const socketService = require('./socket');

/**
 * Places a bid, then immediately tries to match it against an opposing bid.
 * A match creates a REAL Trade document using this app's actual Trade
 * schema (sellerId/buyerId/quantityKWh/pricePerKwh/totalAmount/tradingType)
 * — status starts at 'matched', same as every other trade in this app;
 * verification/settlement still goes through the existing smart-meter +
 * settlement flow, not a shortcut invented here.
 *
 * `tradingType` (optional) switches the matching scope: omitted (or not
 * passed), a bid is hour-scoped — the original intraday slot-trading
 * behavior, matched only against the same date+hour. Passed ('intraday' or
 * 'day-ahead'), a bid is full-day — matched against any opposing bid for
 * the same date+tradingType regardless of hour (the /bid page's "no hour
 * picker" requirement). Both kinds live in the same collection and can
 * coexist; `hour` is still recorded on a full-day bid (the hour it was
 * placed) purely for display, not used to filter matches for it.
 *
 * Simplification, flagged rather than hidden: a partial fill (bid
 * quantities differ) settles at min(quantities) and does NOT re-queue the
 * unfilled remainder as a new pending bid — same "naive first-fit, not a
 * real order book" caveat services/matchingEngine.js already carries for
 * the main marketplace matcher.
 */
async function placeBid(userId, userType, hour, date, bidPrice, bidQuantity, bidType, tradingType) {
  const slot = await TradingSlot.create({ userId, userType, hour, date, bidPrice, bidQuantity, bidType, tradingType });
  const matchResult = await matchSlot(slot._id);

  if (!matchResult) {
    // Still pending — this is the "new-bid" broadcast Marketplace listens
    // for. Re-fetched populated (the just-created doc has a raw userId,
    // not the {firstName,lastName} shape the card needs).
    const populated = await TradingSlot.findById(slot._id).populate('userId', 'firstName lastName');
    socketService.emitNewBid(populated);
    return slot;
  }

  return matchResult.slot;
}

async function matchSlot(slotId) {
  const slot = await TradingSlot.findById(slotId);
  if (!slot || slot.matched) return null;

  const opposingType = slot.bidType === 'sell' ? 'buy' : 'sell';
  // Best price first: a seller wants the highest-paying buyer, a buyer
  // wants the cheapest seller.
  const sortOrder = slot.bidType === 'sell' ? -1 : 1;

  const matchQuery = {
    date: slot.date,
    bidType: opposingType,
    status: 'pending',
    matched: false,
    _id: { $ne: slot._id },
  };
  if (slot.tradingType) {
    matchQuery.tradingType = slot.tradingType; // full-day: any hour, same trading type
  } else {
    matchQuery.hour = slot.hour; // legacy hourly slot: same hour only
    matchQuery.tradingType = { $exists: false };
  }

  const opposingBid = await TradingSlot.findOne(matchQuery).sort({ bidPrice: sortOrder });

  if (!opposingBid) return null;

  const sellBid = slot.bidType === 'sell' ? slot : opposingBid;
  const buyBid = slot.bidType === 'sell' ? opposingBid : slot;
  if (sellBid.bidPrice > buyBid.bidPrice) return null; // no overlap — seller wants more than buyer offers

  const executedQuantity = Math.min(slot.bidQuantity, opposingBid.bidQuantity);
  const executedPrice = Number(((sellBid.bidPrice + buyBid.bidPrice) / 2).toFixed(4));
  const executedTotal = Number((executedQuantity * executedPrice).toFixed(4));

  // Final real balance check right before the match actually happens —
  // routes/slots.js already checks this at bid-*placement* time, but that
  // check used the bid's own price/quantity, not the executed
  // price/quantity a match settles at (the midpoint of both bids, per
  // this function's pricing above), and multiple pending bids can combine
  // to exceed a balance that was fine for each individually. If the buyer
  // can't actually cover the executed total, this match doesn't happen —
  // both bids stay pending, same as any other no-match outcome (a price
  // gap, no opposing bid yet). Flagged, not fixed further: the buyer who
  // triggered this (via their own placeBid call) just sees "still
  // pending" rather than a specific "insufficient funds" message for this
  // particular match — surfacing that distinctly would need placeBid to
  // propagate a reason, more invasive than this scope covers.
  const buyerUser = await User.findById(buyBid.userId).select('walletBalance');
  if ((buyerUser?.walletBalance ?? 0) < executedTotal) return null;

  const trade = await Trade.create({
    sellerId: sellBid.userId,
    buyerId: buyBid.userId,
    quantityKWh: executedQuantity,
    pricePerKwh: executedPrice,
    totalAmount: executedTotal,
    tradingType: slot.tradingType || 'intraday',
    status: 'matched',
  });

  // Real wallet debit/credit — walletBalance is the Razorpay top-up
  // ledger (routes/wallet.js), separate from the existing admin/blockchain
  // Settlement flow (routes/settlements.js), which this doesn't touch.
  const [buyerAfter, sellerAfter] = await Promise.all([
    User.findByIdAndUpdate(buyBid.userId, { $inc: { walletBalance: -executedTotal } }, { new: true }).select('walletBalance'),
    User.findByIdAndUpdate(sellBid.userId, { $inc: { walletBalance: executedTotal } }, { new: true }).select('walletBalance'),
  ]);
  socketService.emitWalletUpdated(buyBid.userId, {
    walletBalance: buyerAfter.walletBalance,
    transaction: { type: 'purchase', amount: executedTotal },
  });
  socketService.emitWalletUpdated(sellBid.userId, {
    walletBalance: sellerAfter.walletBalance,
    transaction: { type: 'sale', amount: executedTotal },
  });

  for (const bid of [slot, opposingBid]) {
    bid.matched = true;
    bid.status = 'matched';
    bid.executedQuantity = executedQuantity;
    bid.executedPrice = executedPrice;
    bid.tradeId = trade._id;
    await bid.save();
  }

  // `slot` is whoever's placeBid() call triggered this match — they already
  // get the result in that call's own response. `opposingBid`'s owner found
  // out asynchronously (their earlier-placed bid just got matched by
  // someone else's later one), so they're the one who needs notifying.
  await notifyMatch({
    userId: opposingBid.userId,
    counterpartyId: slot.userId,
    tradeId: trade._id,
    quantityKWh: executedQuantity,
    pricePerKwh: executedPrice,
    totalAmount: trade.totalAmount,
    asBuyer: opposingBid.bidType === 'buy',
  });

  // Marketplace: both bids just stopped being "available" — broadcast so
  // every connected client (not just these two users) removes them from
  // its live list. Orders: the two users involved get the real new Trade
  // (status 'matched', no blockchain hash yet — that only exists once an
  // admin actually runs settlement, see routes/settlements.js).
  socketService.emitBidMatched([String(slot._id), String(opposingBid._id)]);
  socketService.emitOrderStatusChanged([String(sellBid.userId), String(buyBid.userId)], {
    orderId: String(trade._id),
    newStatus: trade.status,
    quantityKWh: trade.quantityKWh,
    pricePerKwh: trade.pricePerKwh,
    totalAmount: trade.totalAmount,
    blockchainHash: trade.blockchainTxHash || null,
  });

  return { trade, slot, opposingBid };
}

/**
 * Real bug fixed here: this used to return bids of ANY status (including
 * already-matched or cancelled ones) — a matched bid would still look
 * "active" to every other caller. Now scoped to status: 'pending' by
 * default, with an optional bidType filter (Marketplace only wants sell
 * bids; SlotTrading's per-hour bid-count wants both). Populates the
 * bidder's name — needed to show "Prosumer: X" on a bid card the same way
 * ListingCard shows it for an EnergyListing.
 */
async function getSlotsByDate(date, { bidType, status = 'pending' } = {}) {
  const query = { date };
  if (status) query.status = status;
  if (bidType) query.bidType = bidType;
  return TradingSlot.find(query).sort({ hour: 1, createdAt: 1 }).populate('userId', 'firstName lastName');
}

async function getUserSlots(userId, date) {
  return TradingSlot.find({ userId, date }).sort({ hour: 1 });
}

/** All of a user's still-open bids, any date — the /bid page's "active bids" table. */
async function getActiveBids(userId) {
  return TradingSlot.find({ userId, status: 'pending' }).sort({ createdAt: -1 });
}

/** Only a still-pending (unmatched) bid can be cancelled — once matched, a real Trade exists. */
async function cancelBid(slotId, userId) {
  const slot = await TradingSlot.findOne({ _id: slotId, userId });
  if (!slot) return { error: 'not_found' };
  if (slot.status !== 'pending') return { error: 'not_cancellable' };

  slot.status = 'cancelled';
  await slot.save();
  socketService.emitBidCancelled(String(slot._id));
  return { slot };
}

module.exports = { placeBid, matchSlot, getSlotsByDate, getUserSlots, getActiveBids, cancelBid };
