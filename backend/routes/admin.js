const express = require('express');
const mongoose = require('mongoose');
const { User, Trade } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// Real aggregation from the DB — no fabricated numbers. Charts/cards on the
// Admin Dashboard are built entirely from what this returns.
router.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, usersByTypeAgg, totalTrades, volumeAgg, volumeOverTimeAgg, recentTrades] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: { $ifNull: ['$type', 'unassigned'] }, count: { $sum: 1 } } }]),
      Trade.countDocuments(),
      Trade.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      // Daily trade volume for the last 14 days, oldest first — feeds the
      // "Volume over time" chart.
      Trade.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Trade.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('buyerId', 'firstName lastName')
        .populate('sellerId', 'firstName lastName'),
    ]);

    const usersByType = usersByTypeAgg.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    res.json({
      totalUsers,
      usersByType, // e.g. { consumer: 3, prosumer: 2, admin: 1 }
      totalTrades,
      totalVolume: Number((volumeAgg[0]?.total || 0).toFixed(4)),
      volumeOverTime: volumeOverTimeAgg.map((row) => ({
        date: row._id,
        total: Number(row.total.toFixed(4)),
        count: row.count,
      })),
      recentTrades,
      // Real signal, not a fabricated metric: this endpoint only returns a
      // response if Mongoose's connection is actually up (readyState 1).
      systemHealth: {
        api: 'online',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
