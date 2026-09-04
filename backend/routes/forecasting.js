const express = require('express');
const { requireAuth } = require('../middleware/auth');
const forecastService = require('../services/forecastService');

const router = express.Router();
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Identity always comes from the JWT (req.user), never from a URL param —
// the pasted version of this route took userId/userType straight from the
// URL with no auth at all, which would let anyone read (or, worse, drive
// generation of) another user's forecast just by guessing their id.
router.get('/:date', requireAuth, async (req, res, next) => {
  try {
    if (!['prosumer', 'consumer'].includes(req.user.type)) {
      return res.status(403).json({ error: 'Forecasts are only available to consumer/prosumer accounts' });
    }
    if (!DATE_REGEX.test(req.params.date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }

    const forecast = await forecastService.getForecast(req.user.id, req.user.type, req.params.date);
    res.json(forecast);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
