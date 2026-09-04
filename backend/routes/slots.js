const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTradingVerification } = require('../middleware/verification');
const { requireFields } = require('../middleware/validation');
const slotService = require('../services/slotMatchingService');
const { User } = require('../models');

const router = express.Router();
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const TRADING_TYPES = ['intraday', 'dayahead'];

// Bidding moves real money/energy the same as any other trade, so it's
// gated by the same requireTradingVerification check as POST /api/trades —
// the pasted version had no auth or verification at all, and trusted
// userId/userType straight from the request body.
router.post(
  '/bid',
  requireAuth,
  requireTradingVerification,
  requireFields(['bidPrice', 'bidQuantity', 'bidType']),
  async (req, res, next) => {
    try {
      if (!['prosumer', 'consumer'].includes(req.user.type)) {
        return res.status(403).json({ error: 'Slot trading is only available to consumer/prosumer accounts' });
      }

      const { date, bidPrice, bidQuantity, bidType, tradingType } = req.body;
      const priceNum = Number(bidPrice);
      const quantityNum = Number(bidQuantity);
      // Full-day bids (the /bid page) send `tradingType` and no `hour` —
      // hour is still recorded (for display) as "when this was placed".
      // Hourly slot bids (the /slots page) send `hour` explicitly instead.
      const isFullDay = tradingType !== undefined;
      const hourNum = isFullDay ? new Date().getHours() : Number(req.body.hour);
      const dateStr = date || new Date().toISOString().slice(0, 10);

      if (isFullDay && !TRADING_TYPES.includes(tradingType)) {
        return res.status(400).json({ error: `tradingType must be one of: ${TRADING_TYPES.join(', ')}` });
      }
      if (!isFullDay && (!Number.isInteger(hourNum) || hourNum < 0 || hourNum > 23)) {
        return res.status(400).json({ error: 'hour must be an integer 0-23' });
      }
      if (!DATE_REGEX.test(dateStr)) {
        return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
      }
      // Trading-band restriction (₹0.08-₹0.20) removed on request — only
      // "must be a positive number" remains.
      if (!(priceNum > 0)) {
        return res.status(400).json({ error: 'bidPrice must be greater than 0' });
      }
      if (!(quantityNum > 0)) {
        return res.status(400).json({ error: 'bidQuantity must be greater than 0' });
      }
      if (!['buy', 'sell'].includes(bidType)) {
        return res.status(400).json({ error: "bidType must be 'buy' or 'sell'" });
      }
      // A prosumer selling / consumer buying mirrors how the rest of the
      // app assigns roles — prevents a consumer account from placing a
      // sell bid it has no energy to back, and vice versa.
      const expectedBidType = req.user.type === 'prosumer' ? 'sell' : 'buy';
      if (bidType !== expectedBidType) {
        return res.status(403).json({ error: `${req.user.type} accounts can only place '${expectedBidType}' bids` });
      }

      // Real wallet-balance gate on the buy side (see User.walletBalance,
      // the Razorpay top-up ledger) — this is a genuinely new constraint,
      // not present before this feature: a buy bid can only be placed for
      // an amount the buyer's current wallet balance actually covers.
      // Checked at placement time rather than match time, since a match
      // can be triggered by either side's action (see
      // slotMatchingService.matchSlot) and only the buyer's own request
      // here can get a clean, immediate error message. Known simplification,
      // flagged: this doesn't reserve/escrow funds, so multiple pending buy
      // bids can still combine to exceed the balance checked at each one's
      // placement time — debiting happens for real at match time
      // (slotMatchingService.matchSlot), where a final balance check runs
      // again before any money moves.
      if (bidType === 'buy') {
        const cost = priceNum * quantityNum;
        const buyer = await User.findById(req.user.id).select('walletBalance');
        if ((buyer?.walletBalance ?? 0) < cost) {
          return res.status(400).json({
            error: `Insufficient balance. Need ₹${cost.toFixed(2)}, have ₹${(buyer?.walletBalance ?? 0).toFixed(2)}.`,
          });
        }
      }

      const slot = await slotService.placeBid(
        req.user.id,
        req.user.type,
        hourNum,
        dateStr,
        priceNum,
        quantityNum,
        bidType,
        isFullDay ? tradingType : undefined
      );
      res.status(201).json(slot);
    } catch (err) {
      next(err);
    }
  }
);

// Returns every pending bid for the date, any user — this is the "show
// prosumer sell bids to consumers (and vice versa)" endpoint Marketplace.jsx
// uses. No user-type filtering: a consumer sees sell bids, a prosumer sees
// buy bids, same query either way — the ?bidType filter is just a
// convenience for a caller that only wants one side.
router.get('/date/:date', requireAuth, async (req, res, next) => {
  try {
    if (!DATE_REGEX.test(req.params.date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }
    const { bidType } = req.query;
    if (bidType && !['buy', 'sell'].includes(bidType)) {
      return res.status(400).json({ error: "bidType must be 'buy' or 'sell'" });
    }
    const slots = await slotService.getSlotsByDate(req.params.date, { bidType });
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

// All of the caller's still-open bids, any date — feeds the /bid page's
// active-bids table, which (per spec) isn't scoped to a single date.
// Registered BEFORE /mine/:date so "active" doesn't get swallowed as a
// (then DATE_REGEX-rejected) :date value.
router.get('/mine/active', requireAuth, async (req, res, next) => {
  try {
    const slots = await slotService.getActiveBids(req.user.id);
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

// Not in the original spec, but the pasted "Active Bids" table showed every
// user's bids to every other logged-in user — this scopes it to the
// caller's own bids instead.
router.get('/mine/:date', requireAuth, async (req, res, next) => {
  try {
    if (!DATE_REGEX.test(req.params.date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }
    const slots = await slotService.getUserSlots(req.user.id, req.params.date);
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const result = await slotService.cancelBid(req.params.id, req.user.id);
    if (result.error === 'not_found') return res.status(404).json({ error: 'Bid not found' });
    if (result.error === 'not_cancellable') return res.status(400).json({ error: 'Only a pending (unmatched) bid can be cancelled' });
    res.json(result.slot);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
