const express = require('express');
const { Trade, Settlement } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { settleTrade } = require('../services/settlementService');
const socketService = require('../services/socket');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const settlements = await Settlement.find().populate('tradeId').sort({ createdAt: -1 });
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
    trade.blockchainTxHash = settlement.blockchainTxHash;
    trade.settledAt = settlement.settledAt;
    await trade.save();

    // The honest equivalent of the spec's "bid-executed" event — this is
    // the one real place in the app a blockchain hash gets attached, so
    // it's what the Orders page's "show blockchain link" behavior wires to.
    socketService.emitOrderStatusChanged([String(trade.sellerId), String(trade.buyerId)], {
      orderId: String(trade._id),
      newStatus: trade.status,
      blockchainHash: trade.blockchainTxHash,
    });

    res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
