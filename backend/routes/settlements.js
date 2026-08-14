const express = require('express');
const { Trade, Settlement } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { settleTrade } = require('../services/settlementService');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const settlements = await Settlement.find().populate('trade').sort({ createdAt: -1 });
    res.json(settlements);
  } catch (err) {
    next(err);
  }
});

router.post('/:tradeId', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const trade = await Trade.findById(req.params.tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const settlement = await settleTrade(trade);
    trade.status = 'settled';
    trade.txHash = settlement.settledTxHash;
    await trade.save();

    res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
