const express = require('express');
const adminSettlementService = require('../../services/adminSettlementService');
const adminLogService = require('../../services/adminLogService');

const router = express.Router();

const STATUSES = ['pending', 'completed', 'failed'];

router.get('/', async (req, res, next) => {
  try {
    const { status, from, to } = req.query;
    const settlements = await adminSettlementService.getSettlements({ status, from, to });
    res.json(settlements);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const settlement = await adminSettlementService.getSettlementDetail(req.params.id);
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    res.json(settlement);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, blockchainTxHash } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    const settlement = await adminSettlementService.setStatus(req.params.id, status, blockchainTxHash);
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

    await adminLogService.logAction(req.user.id, 'settlement.status-override', 'settlement', settlement._id, `Set to ${status}`);
    res.json(settlement);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
