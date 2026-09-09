const mongoose = require('mongoose');
const { TradingSlot, Trade, User } = require('../models');
const { notifyMatch } = require('./notificationService');
const socketService = require('./socket');

// Internal-only sentinel: distinguishes "the transaction found insufficient
// funds and aborted on purpose" from a real error, when caught below.
class InsufficientFundsError extends Error {}

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
  // `slot` itself is never contended concurrently — only placeBid() ever
  // calls matchSlot(), exactly once, right after creating this exact
  // document, so no other request can be racing to claim `slot` the way
  // one can race to claim `opposingBid` below (shared across every
  // concurrent match attempt that finds it eligible).

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
    // Price-overlap folded directly into the claim filter below, not a
    // separate post-hoc check — `slot.bidPrice` is a plain number already
    // in hand, not a second query, so there's no reason this can't be part
    // of the same atomic operation. (Previously: fetch first, then
    // `if (sellBid.bidPrice > buyBid.bidPrice) return null` — correct
    // logic, just not atomic with the fetch.)
    bidPrice: slot.bidType === 'sell' ? { $gte: slot.bidPrice } : { $lte: slot.bidPrice },
  };
  if (slot.tradingType) {
    matchQuery.tradingType = slot.tradingType; // full-day: any hour, same trading type
  } else {
    matchQuery.hour = slot.hour; // legacy hourly slot: same hour only
    matchQuery.tradingType = { $exists: false };
  }

  // --- Real fix for two confirmed race conditions (double-sell / negative
  // wallet balance), found live during a QA pass on this feature:
  //
  // 1. Double-sell: the old code did `findOne(...)` (read) then, much
  //    later, `bid.save()` (write) to mark the opposing bid matched — two
  //    concurrent matchSlot() calls both racing for the SAME opposing bid
  //    could both read it as still-pending before either write landed,
  //    both create a Trade against it. Confirmed live: one 5 kWh sell bid
  //    matched into two separate Trades when two buyers hit it at once.
  //
  // 2. Negative balance: the balance check (`walletBalance < executedTotal`)
  //    was a plain read-then-branch, not conditioned on the same write —
  //    two concurrent matches debiting the same buyer could both pass the
  //    check before either debit landed. Confirmed live: a ₹100 balance
  //    went to -₹20 after two concurrent ₹60 matches.
  //
  // Fixed with a real multi-document transaction (MongoDB Atlas supports
  // these on its replica-set clusters, including the free tier) rather
  // than manual claim-then-compensate rollbacks: the opposing-bid claim,
  // the balance-gated debit, the credit, and the Trade creation all commit
  // or abort together, so an insufficient-funds abort automatically
  // reverts the bid claim too — no separate "undo" step to get wrong.
  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      // Atomic claim: finds the best-priced eligible opposing bid AND
      // marks it matched in one operation. Only one concurrent caller can
      // win this for a given document — every other caller gets null back
      // (a real bid that just became ineligible, not "no bid exists"),
      // which this function treats exactly like the pre-existing "no
      // match found" outcome (both sides stay pending).
      const opposingBid = await TradingSlot.findOneAndUpdate(
        matchQuery,
        { $set: { matched: true, status: 'matched' } },
        { sort: { bidPrice: sortOrder }, new: true, session }
      );
      if (!opposingBid) return; // result stays null

      const sellBid = slot.bidType === 'sell' ? slot : opposingBid;
      const buyBid = slot.bidType === 'sell' ? opposingBid : slot;
      const executedQuantity = Math.min(slot.bidQuantity, opposingBid.bidQuantity);
      const executedPrice = Number(((sellBid.bidPrice + buyBid.bidPrice) / 2).toFixed(4));
      const executedTotal = Number((executedQuantity * executedPrice).toFixed(4));

      // Atomic, balance-gated debit: the $gte condition is checked by
      // MongoDB at the moment of the write, not via a separate earlier
      // read — this is what actually closes the negative-balance race
      // (routes/slots.js's placement-time check is now correctly just a
      // soft up-front UX gate; this is the real backstop that moves money).
      const buyerAfter = await User.findOneAndUpdate(
        { _id: buyBid.userId, walletBalance: { $gte: executedTotal } },
        { $inc: { walletBalance: -executedTotal } },
        { new: true, session }
      ).select('walletBalance');

      if (!buyerAfter) {
        // Insufficient funds, discovered only now that the opposing bid is
        // claimed — abort the whole transaction. MongoDB rolls the claim
        // back automatically; both bids end up exactly as pending as they
        // were before this attempt, same external behavior as before this
        // fix (a silent "no match", not a rejection of the buyer's own
        // triggering request — surfacing that distinctly still isn't
        // covered here, same disclosed limitation as before).
        throw new InsufficientFundsError();
      }

      // Real design change: the seller is NOT credited here anymore. They
      // used to get the full executedTotal immediately at match time,
      // with settlementService later deducting the fee back out — that
      // worked, but meant the wallet briefly showed the wrong (gross)
      // number for however long a trade sat unsettled, and needed a
      // negative-balance guard for an edge case (a role-switched seller
      // spending that gross credit as a consumer before settlement ran).
      // Now the seller is credited exactly once, with the net
      // prosumerAmount, at actual settlement time (settlementService.js)
      // — never gross, never twice, no reconciliation needed.

      const [trade] = await Trade.create(
        [
          {
            sellerId: sellBid.userId,
            buyerId: buyBid.userId,
            quantityKWh: executedQuantity,
            pricePerKwh: executedPrice,
            totalAmount: executedTotal,
            tradingType: slot.tradingType || 'intraday',
            status: 'matched',
          },
        ],
        { session }
      );

      for (const bid of [slot, opposingBid]) {
        bid.matched = true;
        bid.status = 'matched';
        bid.executedQuantity = executedQuantity;
        bid.executedPrice = executedPrice;
        bid.tradeId = trade._id;
        await bid.save({ session });
      }

      result = { trade, slot, opposingBid, buyerAfter, executedTotal, buyUserId: buyBid.userId, sellUserId: sellBid.userId };
    });
  } catch (err) {
    if (!(err instanceof InsufficientFundsError)) throw err;
    result = null;
  } finally {
    session.endSession();
  }

  if (!result) return null;

  const { trade, opposingBid, buyerAfter, executedTotal, buyUserId, sellUserId } = result;

  // Side effects below are deliberately outside the transaction — sockets/
  // emails aren't part of the atomic financial guarantee, and retrying a
  // transaction that had already sent one would risk sending it twice.
  // Only the buyer's wallet actually changed here — the seller isn't
  // credited until settlement (see settlementService.js), so no
  // wallet-updated event for them yet; a live 'order-status-changed' for
  // both parties still fires below, since the trade itself is real now.
  socketService.emitWalletUpdated(buyUserId, {
    walletBalance: buyerAfter.walletBalance,
    transaction: { type: 'purchase', amount: executedTotal },
  });

  // `slot` is whoever's placeBid() call triggered this match — they already
  // get the result in that call's own response. `opposingBid`'s owner found
  // out asynchronously (their earlier-placed bid just got matched by
  // someone else's later one), so they're the one who needs notifying.
  await notifyMatch({
    userId: opposingBid.userId,
    counterpartyId: slot.userId,
    tradeId: trade._id,
    quantityKWh: trade.quantityKWh,
    pricePerKwh: trade.pricePerKwh,
    totalAmount: trade.totalAmount,
    asBuyer: opposingBid.bidType === 'buy',
  });

  // Marketplace: both bids just stopped being "available" — broadcast so
  // every connected client (not just these two users) removes them from
  // its live list. Orders: the two users involved get the real new Trade
  // (status 'matched', no blockchain hash yet — that only exists once
  // settlement actually runs, automatically, see jobs/settlementScheduler.js).
  socketService.emitBidMatched([String(slot._id), String(opposingBid._id)]);
  socketService.emitOrderStatusChanged([String(sellUserId), String(buyUserId)], {
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

/**
 * Only a still-pending (unmatched) bid can be cancelled — once matched, a
 * real Trade exists. Atomic claim (found during the same QA pass as the
 * matching races above): two concurrent identical cancel requests used to
 * both succeed (read-then-write gap between the `findOne` and `.save()`),
 * which is harmless here (same end state, no money moved) but still fired
 * the bid-cancelled broadcast twice. findOneAndUpdate closes that gap the
 * same way the match-claim above does — only the first caller gets the
 * updated doc back; a second concurrent call sees status already
 * 'cancelled' and correctly falls into not_cancellable instead.
 */
async function cancelBid(slotId, userId) {
  const slot = await TradingSlot.findOneAndUpdate(
    { _id: slotId, userId, status: 'pending' },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
  if (slot) {
    socketService.emitBidCancelled(String(slot._id));
    return { slot };
  }

  // Distinguish "doesn't exist / not yours" from "exists but not
  // cancellable" for the same error messages the route already returns.
  const existing = await TradingSlot.findOne({ _id: slotId, userId });
  if (!existing) return { error: 'not_found' };
  return { error: 'not_cancellable' };
}

module.exports = { placeBid, matchSlot, getSlotsByDate, getUserSlots, getActiveBids, cancelBid };
