const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTradingVerification } = require('../middleware/verification');
const { requireFields } = require('../middleware/validation');
const { AuctionOrder, Trade, User } = require('../models');
const { ROUND_CYCLE_MS, SETTLEMENT_GAP_MS } = require('../jobs/auctionScheduler');

const router = express.Router();

// Server start time is a good-enough anchor for "when's the next round":
// the scheduler's setInterval fires every ROUND_CYCLE_MS (collection window
// + settlement buffer) from process start, so the next boundary is
// deterministic from here without exporting timer internals. Was
// AUCTION_INTERVAL_MS alone before the settlement buffer existed — using
// just the collection window here would under-report the wait once a
// buffer sits between rounds.
const SERVER_START = Date.now();
function msUntilNextRound() {
  const elapsed = Date.now() - SERVER_START;
  return ROUND_CYCLE_MS - (elapsed % ROUND_CYCLE_MS);
}

/**
 * Place a BUY or SELL order into the next auction round.
 *
 * Same gates as POST /api/slots/bid — this moves real money and energy:
 *  - requireAuth: identity is req.user.id (JWT), never a body field
 *  - requireTradingVerification: KYC must be verified
 *  - role: prosumer -> SELL only, consumer -> BUY only
 *  - buy side: soft wallet-balance check here (clean immediate error); the
 *    real balance-gated debit happens atomically at clearing time
 *    (jobs/auctionScheduler.js). Like the slot bids, this does NOT escrow
 *    funds, so several pending buy orders can together exceed the balance
 *    checked at each one's placement — the clearing-time $gte debit is the
 *    backstop, and an uncovered order is simply skipped and left pending.
 */
router.post(
  '/orders',
  requireAuth,
  requireTradingVerification,
  requireFields(['side', 'quantity', 'pricePerKwh']),
  async (req, res, next) => {
    try {
      if (!['prosumer', 'consumer'].includes(req.user.type)) {
        return res.status(403).json({ error: 'Auction trading is only available to consumer/prosumer accounts' });
      }

      const side = String(req.body.side).toUpperCase();
      const quantity = Number(req.body.quantity);
      const pricePerKwh = Number(req.body.pricePerKwh);

      if (!['BUY', 'SELL'].includes(side)) {
        return res.status(400).json({ error: "side must be 'BUY' or 'SELL'" });
      }
      if (!(quantity > 0)) {
        return res.status(400).json({ error: 'quantity must be greater than 0' });
      }
      if (!(pricePerKwh > 0)) {
        return res.status(400).json({ error: 'pricePerKwh must be greater than 0' });
      }

      const expectedSide = req.user.type === 'prosumer' ? 'SELL' : 'BUY';
      if (side !== expectedSide) {
        return res.status(403).json({ error: `${req.user.type} accounts can only place '${expectedSide}' orders` });
      }

      if (side === 'BUY') {
        const cost = pricePerKwh * quantity;
        const buyer = await User.findById(req.user.id).select('walletBalance');
        if ((buyer?.walletBalance ?? 0) < cost) {
          return res.status(400).json({
            error: `Insufficient balance. Need ₹${cost.toFixed(2)}, have ₹${(buyer?.walletBalance ?? 0).toFixed(2)}.`,
          });
        }
      }

      const order = await AuctionOrder.create({
        userId: req.user.id,
        userType: req.user.type,
        side,
        quantity,
        originalQuantity: quantity,
        pricePerKwh,
      });

      res.status(201).json({ order, nextRoundInMs: msUntilNextRound() });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Anonymised order-book depth for the round that's currently collecting.
 * Deliberately NOT the per-user detail the slot endpoint returns — a
 * sealed-bid double auction works precisely because participants don't see
 * who bid what before it clears. Callers get the price/quantity ladder and
 * totals, not identities. (Flagged deviation from the pasted spec, which
 * returned every order's userId to everyone.)
 */
router.get('/orders', requireAuth, async (req, res, next) => {
  try {
    const [buys, sells] = await Promise.all([
      AuctionOrder.find({ status: 'pending', side: 'BUY' }).select('quantity pricePerKwh filledQuantity').sort({ pricePerKwh: -1 }),
      AuctionOrder.find({ status: 'pending', side: 'SELL' }).select('quantity pricePerKwh filledQuantity').sort({ pricePerKwh: 1 }),
    ]);
    res.json({
      buy: { count: buys.length, totalQuantity: round4(sum(buys)), ladder: ladder(buys), carriedOverQuantity: carriedOver(buys) },
      sell: { count: sells.length, totalQuantity: round4(sum(sells)), ladder: ladder(sells), carriedOverQuantity: carriedOver(sells) },
      nextRoundInMs: msUntilNextRound(),
      // So the frontend's "collecting vs settlement buffer" phase boundary
      // always matches this server's actual configured gap, even if
      // SETTLEMENT_GAP_MS is overridden via env — never hardcode it client-side.
      settlementGapMs: SETTLEMENT_GAP_MS,
    });
  } catch (err) {
    next(err);
  }
});

/** The caller's own auction orders (any status), newest first. */
router.get('/orders/mine', requireAuth, async (req, res, next) => {
  try {
    const orders = await AuctionOrder.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

/** Cancel one of the caller's still-pending orders. */
router.post('/orders/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const order = await AuctionOrder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: 'pending' },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    if (!order) {
      const exists = await AuctionOrder.findOne({ _id: req.params.id, userId: req.user.id });
      if (!exists) return res.status(404).json({ error: 'Order not found' });
      return res.status(400).json({ error: 'Only a pending order can be cancelled' });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * Trades from auction rounds the caller took part in (as buyer or seller).
 * Blockchain hash / settled status on these comes from the normal
 * settlementScheduler flow, same as any other trade.
 */
router.get('/matches', requireAuth, async (req, res, next) => {
  try {
    const trades = await Trade.find({
      auctionRound: { $ne: null },
      $or: [{ buyerId: req.user.id }, { sellerId: req.user.id }],
    })
      .populate('sellerId', 'firstName lastName')
      .populate('buyerId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(trades);
  } catch (err) {
    next(err);
  }
});

function sum(orders) {
  return orders.reduce((t, o) => t + o.quantity, 0);
}
function round4(n) {
  return Number(n.toFixed(4));
}
// Collapse orders to a price -> cumulative-quantity ladder (still anonymous).
function ladder(orders) {
  const byPrice = new Map();
  for (const o of orders) byPrice.set(o.pricePerKwh, (byPrice.get(o.pricePerKwh) || 0) + o.quantity);
  return [...byPrice.entries()].map(([price, quantity]) => ({ price, quantity: round4(quantity) }));
}
// A still-'pending' order with filledQuantity > 0 is, by definition, the
// unfilled remainder of an order that already partially cleared in an
// earlier round and rolled forward (see jobs/auctionScheduler.js) — this is
// the real mechanism behind "auction 1 and auction 2 orders showing
// together" (confirmed via audit). There's no separate "which round is
// this order in" field to filter on (see AuctionOrder.js — an order
// doesn't belong to a round until it clears against one, and forcing a
// hard round-tag would orphan a rolled-over remainder the first time it
// missed its original tagged round). Surfacing the carried-over volume as
// a labeled subtotal — rather than pretending there are two separate order
// books — tells the truth about what's actually happening without adding
// a schema change that risks silently losing orders after a restart.
function carriedOver(orders) {
  return round4(orders.filter((o) => o.filledQuantity > 0).reduce((t, o) => t + o.quantity, 0));
}

module.exports = router;
