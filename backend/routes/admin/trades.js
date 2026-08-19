const express = require('express');
const adminTradeService = require('../../services/adminTradeService');
const adminLogService = require('../../services/adminLogService');

const router = express.Router();

const DECISIONS = ['approve_trade', 'refund_consumer', 'refund_both', 'no_action'];

router.get('/', async (req, res, next) => {
  try {
    const { status, prosumer, consumer, from, to } = req.query;
    const trades = await adminTradeService.getTrades({ status, prosumer, consumer, from, to });
    res.json(trades);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const trade = await adminTradeService.getTradeDetail(req.params.id);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json(trade);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/dispute', async (req, res, next) => {
  try {
    if (!req.body.reason) return res.status(400).json({ error: 'reason is required' });
    const trade = await adminTradeService.markDisputed(req.params.id, req.body.reason, req.user.id);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    await adminLogService.logAction(req.user.id, 'trade.dispute', 'trade', trade._id, req.body.reason);
    res.json(trade);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/resolve', async (req, res, next) => {
  try {
    const { decision, notes } = req.body;
    if (!DECISIONS.includes(decision)) {
      return res.status(400).json({ error: `decision must be one of: ${DECISIONS.join(', ')}` });
    }
    if (!notes) return res.status(400).json({ error: 'notes is required' });

    const trade = await adminTradeService.resolveDispute(req.params.id, decision, notes, req.user.id);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    if (trade.error) return res.status(400).json({ error: trade.error });

    await adminLogService.logAction(req.user.id, 'trade.resolve-dispute', 'trade', trade._id, `${decision}: ${notes}`);
    res.json(trade);
  } catch (err) {
    next(err);
  }
});

// "Manual settlement adjustment" per spec — deliberately narrow: it does not
// re-run the fee split or push a new on-chain record, only lets an admin
// force a trade's status when the normal settlement flow got stuck. Real
// settlement corrections belong in /admin/settlements/:id/status instead.
router.post('/:id/settlement-override', async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!['settled', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: "status must be 'settled' or 'cancelled'" });
    }
    const trade = await adminTradeService.getTradeDetail(req.params.id);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });

    trade.status = status;
    if (status === 'settled' && !trade.settledAt) trade.settledAt = new Date();
    await trade.save();

    await adminLogService.logAction(
      req.user.id,
      'trade.settlement-override',
      'trade',
      trade._id,
      `Forced status to ${status}${notes ? `: ${notes}` : ''}`
    );
    res.json(trade);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
