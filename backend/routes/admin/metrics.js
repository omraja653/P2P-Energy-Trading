const express = require('express');
const adminMetricsService = require('../../services/adminMetricsService');
const adminLogService = require('../../services/adminLogService');
const { Trade, Ticket } = require('../../models');
const adminKycService = require('../../services/adminKycService');

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    res.json(await adminMetricsService.getDashboardMetrics());
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/users', async (req, res, next) => {
  try {
    res.json(await adminMetricsService.getUserAnalytics(Number(req.query.days) || 30));
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/trades', async (req, res, next) => {
  try {
    res.json(await adminMetricsService.getTradeAnalytics(Number(req.query.days) || 30));
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/revenue', async (req, res, next) => {
  try {
    res.json(await adminMetricsService.getRevenueBreakdown());
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/blockchain', async (req, res, next) => {
  try {
    res.json(await adminMetricsService.getBlockchainAnalytics());
  } catch (err) {
    next(err);
  }
});

// Feeds the Admin Dashboard's "Quick Actions" sidebar counts.
router.get('/quick-actions', async (req, res, next) => {
  try {
    const [pendingKyc, disputedTrades, openTickets] = await Promise.all([
      adminKycService.getQueue({ status: 'pending' }),
      Trade.countDocuments({ status: 'disputed' }),
      Ticket.aggregate([
        { $match: { status: { $in: ['Open', 'Pending', 'In Progress'] } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      pendingKycCount: pendingKyc.length,
      disputedTradesCount: disputedTrades,
      openTicketsByPriority: openTickets.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {}),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const logs = await adminLogService.getLogs({ limit: Number(req.query.limit) || 50, targetType: req.query.targetType });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
