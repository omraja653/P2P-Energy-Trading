const express = require('express');
const { Trade, Settlement } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { settleTradeAndUpdateTrade } = require('../services/settlementService');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const settlements = await Settlement.find().populate('tradeId').sort({ createdAt: -1 });
    res.json(settlements);
  } catch (err) {
    next(err);
  }
});

// Kept as a real, working manual override even though the primary path is
// now automatic (jobs/settlementScheduler.js runs the same
// settleTradeAndUpdateTrade helper on a timer) — useful for retrying a
// trade the scheduler's log shows failed, or for testing. Not currently
// exposed by a button in AdminTrades.jsx (removed per this task), but
// the endpoint itself stays real and callable.
router.post('/:tradeId', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const trade = await Trade.findById(req.params.tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    // Nothing stopped this route being called twice for the same trade —
    // harmless before (just wasted gas re-recording on-chain), but
    // settleTrade() now credits real money to the seller, so a double
    // call would double-pay them.
    if (trade.status === 'settled') {
      return res.status(400).json({ error: 'This trade has already been settled' });
    }

    const settlement = await settleTradeAndUpdateTrade(trade);
    res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
