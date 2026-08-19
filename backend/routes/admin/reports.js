const express = require('express');
const adminMetricsService = require('../../services/adminMetricsService');
const { Trade } = require('../../models');

const router = express.Router();

router.get('/revenue', async (req, res, next) => {
  try {
    const [breakdown, tradeStats] = await Promise.all([
      adminMetricsService.getRevenueBreakdown(),
      Trade.aggregate([{ $group: { _id: null, totalTrades: { $sum: 1 }, totalVolumeKWh: { $sum: '$quantityKWh' } } }]),
    ]);
    const stats = tradeStats[0] || { totalTrades: 0, totalVolumeKWh: 0 };
    res.json({ ...breakdown, totalTrades: stats.totalTrades, totalVolumeKWh: Number(stats.totalVolumeKWh.toFixed(2)) });
  } catch (err) {
    next(err);
  }
});

router.get('/compliance', async (req, res, next) => {
  try {
    res.json(await adminMetricsService.getComplianceReport());
  } catch (err) {
    next(err);
  }
});

router.get('/disputes', async (req, res, next) => {
  try {
    res.json(await adminMetricsService.getDisputesReport());
  } catch (err) {
    next(err);
  }
});

// Blockchain report reuses the same analytics endpoint's data — kept as a
// distinct route since the spec lists it under /reports too.
router.get('/blockchain', async (req, res, next) => {
  try {
    res.json(await adminMetricsService.getBlockchainAnalytics());
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const type = req.query.type || 'revenue';
    if (type !== 'revenue') {
      return res.status(400).json({ error: "Only type=revenue is currently exportable" });
    }
    const csv = await adminMetricsService.exportRevenueCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="gridmate-revenue-report.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
