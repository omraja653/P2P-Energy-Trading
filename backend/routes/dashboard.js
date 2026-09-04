const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Trade } = require('../models');
const forecastService = require('../services/forecastService');
const notificationService = require('../services/notificationService');

const router = express.Router();

function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Thin aggregator for the unified Dashboard — composes three existing,
// already-tested data sources (forecast, trades, notifications) rather than
// introducing a new model or duplicating their logic.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!['prosumer', 'consumer'].includes(req.user.type)) {
      return res.status(403).json({ error: 'Dashboard is only available to consumer/prosumer accounts' });
    }

    const idField = req.user.type === 'prosumer' ? 'sellerId' : 'buyerId';

    const [forecast, recentTrades, recentNotifications] = await Promise.all([
      forecastService.getForecast(req.user.id, req.user.type, tomorrowDateStr()),
      Trade.find({ [idField]: req.user.id })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('buyerId', 'firstName lastName')
        .populate('sellerId', 'firstName lastName'),
      notificationService.getNotifications(req.user.id, { unseenOnly: false }),
    ]);

    const activity = [
      ...recentTrades.map((t) => ({
        type: 'trade',
        id: t._id,
        description: `${req.user.type === 'prosumer' ? 'Sold' : 'Bought'} ${t.quantityKWh} kWh at ₹${t.pricePerKwh}/kWh`,
        status: t.status,
        timestamp: t.createdAt,
      })),
      ...recentNotifications.slice(0, 3).map((n) => ({
        type: 'notification',
        id: n._id,
        description: `Matched with ${n.counterpartyName} — ${n.quantityKWh} kWh at ₹${n.pricePerKwh}/kWh`,
        status: 'matched',
        timestamp: n.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 3);

    res.json({ forecast, recentActivity: activity });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
