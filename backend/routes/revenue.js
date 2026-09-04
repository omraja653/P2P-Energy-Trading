const express = require('express');
const { requireAuth } = require('../middleware/auth');
const revenueService = require('../services/revenueService');

const router = express.Router();
const MONTH_REGEX = /^\d{4}-\d{2}$/;

router.get('/:month', requireAuth, async (req, res, next) => {
  try {
    if (!['prosumer', 'consumer'].includes(req.user.type)) {
      return res.status(403).json({ error: 'Revenue data is only available to consumer/prosumer accounts' });
    }
    if (!MONTH_REGEX.test(req.params.month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format' });
    }

    const revenue = await revenueService.getRevenue(req.user.id, req.user.type, req.params.month);
    res.json(revenue);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
