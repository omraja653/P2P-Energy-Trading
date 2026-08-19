const { User, Trade, Settlement } = require('../models');
const ticketService = require('./ticketService');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** The 8 headline cards on the Admin Dashboard — every number is a real query. */
async function getDashboardMetrics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

  const [
    totalUsers,
    newUsersLast30,
    tradesToday,
    volumeAgg,
    revenueAgg,
    activeProsumers,
    activeConsumers,
    settlementCounts,
    ticketMetrics,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Trade.countDocuments({ createdAt: { $gte: startOfToday } }),
    Trade.aggregate([{ $group: { _id: null, totalKWh: { $sum: '$quantityKWh' } } }]),
    Settlement.aggregate([{ $group: { _id: null, total: { $sum: '$platformAmount' } } }]),
    User.countDocuments({ type: 'prosumer', status: 'ACTIVE' }),
    User.countDocuments({ type: 'consumer', status: 'ACTIVE' }),
    Settlement.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ticketService.getTicketMetrics(),
  ]);

  const settlementByStatus = settlementCounts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});
  const completed = settlementByStatus.completed || 0;
  const failed = settlementByStatus.failed || 0;
  const settlementSuccessRate = completed + failed > 0 ? (completed / (completed + failed)) * 100 : null;

  const existingUsers = totalUsers - newUsersLast30;
  const userGrowthPercent = existingUsers > 0 ? Number(((newUsersLast30 / existingUsers) * 100).toFixed(1)) : null;

  return {
    totalUsers,
    userGrowthPercent,
    tradesToday,
    totalVolumeKWh: Number((volumeAgg[0]?.totalKWh || 0).toFixed(2)),
    platformRevenue: Number((revenueAgg[0]?.total || 0).toFixed(2)),
    activeProsumers,
    activeConsumers,
    settlementSuccessRate: settlementSuccessRate != null ? Number(settlementSuccessRate.toFixed(1)) : null,
    avgSupportResponseHours: ticketMetrics.avgResponseTimeHours,
  };
}

/** User growth over the last N days — cumulative signups per day, plus role breakdown. */
async function getUserAnalytics(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [dailySignups, usersBefore, roleBreakdown] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    User.countDocuments({ createdAt: { $lt: since } }),
    User.aggregate([{ $group: { _id: { $ifNull: ['$type', 'unassigned'] }, count: { $sum: 1 } } }]),
  ]);

  let cumulative = usersBefore;
  const growth = dailySignups.map((row) => {
    cumulative += row.count;
    return { date: row._id, newUsers: row.count, cumulativeUsers: cumulative };
  });

  return {
    growth,
    roleBreakdown: roleBreakdown.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {}),
  };
}

/** Daily trade volume/price + a real dispute rate over the last N days. */
async function getTradeAnalytics(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [daily, totalInRange, disputedInRange] = await Promise.all([
    Trade.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          volumeKWh: { $sum: '$quantityKWh' },
          totalAmount: { $sum: '$totalAmount' },
          avgPrice: { $avg: '$pricePerKwh' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Trade.countDocuments({ createdAt: { $gte: since } }),
    Trade.countDocuments({ createdAt: { $gte: since }, 'dispute.raisedAt': { $exists: true } }),
  ]);

  return {
    daily: daily.map((row) => ({
      date: row._id,
      volumeKWh: Number(row.volumeKWh.toFixed(2)),
      totalAmount: Number(row.totalAmount.toFixed(2)),
      avgPrice: Number(row.avgPrice.toFixed(4)),
      count: row.count,
    })),
    disputeRate: totalInRange > 0 ? Number(((disputedInRange / totalInRange) * 100).toFixed(2)) : 0,
    totalTrades: totalInRange,
    disputedTrades: disputedInRange,
  };
}

/** Revenue split: prosumer payout vs grid wheeling fee vs platform fee. */
async function getRevenueBreakdown() {
  const agg = await Settlement.aggregate([
    {
      $group: {
        _id: null,
        prosumerAmount: { $sum: '$prosumerAmount' },
        gridWheelAmount: { $sum: '$gridWheelAmount' },
        platformAmount: { $sum: '$platformAmount' },
      },
    },
  ]);

  const row = agg[0] || { prosumerAmount: 0, gridWheelAmount: 0, platformAmount: 0 };
  return {
    prosumerAmount: Number(row.prosumerAmount.toFixed(2)),
    gridWheelAmount: Number(row.gridWheelAmount.toFixed(2)),
    platformAmount: Number(row.platformAmount.toFixed(2)),
    total: Number((row.prosumerAmount + row.gridWheelAmount + row.platformAmount).toFixed(2)),
  };
}

/**
 * Blockchain settlement analytics. Success rate and average confirmation
 * time (settledAt - createdAt on completed settlements) are real. Gas fees
 * are NOT tracked anywhere in this project (no per-tx gas capture), so
 * that field is honestly omitted rather than invented.
 */
async function getBlockchainAnalytics() {
  const [counts, completedSettlements] = await Promise.all([
    Settlement.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Settlement.find({ status: 'completed', settledAt: { $ne: null } }, 'createdAt settledAt'),
  ]);

  const byStatus = counts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const confirmationTimesMs = completedSettlements.map((s) => new Date(s.settledAt) - new Date(s.createdAt));
  const avgConfirmationMinutes = confirmationTimesMs.length
    ? Number((confirmationTimesMs.reduce((a, b) => a + b, 0) / confirmationTimesMs.length / 60000).toFixed(1))
    : null;

  return {
    totalSettlements: total,
    byStatus: { pending: byStatus.pending || 0, completed: byStatus.completed || 0, failed: byStatus.failed || 0 },
    successRate: total > 0 ? Number((((byStatus.completed || 0) / total) * 100).toFixed(1)) : null,
    avgConfirmationMinutes,
  };
}

/** Email/mobile/KYC verification completion, overall and by role. */
async function getComplianceReport() {
  const [overall, byRole] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          emailVerified: { $sum: { $cond: ['$emailVerified', 1, 0] } },
          mobileVerified: { $sum: { $cond: ['$mobileVerified', 1, 0] } },
          kycVerified: { $sum: { $cond: ['$kycVerified', 1, 0] } },
        },
      },
    ]),
    User.aggregate([
      { $match: { type: { $in: ['consumer', 'prosumer'] } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          kycVerified: { $sum: { $cond: ['$kycVerified', 1, 0] } },
        },
      },
    ]),
  ]);

  const o = overall[0] || { total: 0, emailVerified: 0, mobileVerified: 0, kycVerified: 0 };
  const pct = (n, total) => (total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0);

  return {
    totalUsers: o.total,
    emailVerifiedPercent: pct(o.emailVerified, o.total),
    mobileVerifiedPercent: pct(o.mobileVerified, o.total),
    kycVerifiedPercent: pct(o.kycVerified, o.total),
    byRole: byRole.map((r) => ({ role: r._id, total: r.total, kycVerifiedPercent: pct(r.kycVerified, r.total) })),
  };
}

/** Dispute stats: rate, avg resolution time, decision breakdown. */
async function getDisputesReport() {
  const disputed = await Trade.find({ 'dispute.raisedAt': { $exists: true } }, 'dispute status createdAt');
  const totalTrades = await Trade.countDocuments();

  const resolved = disputed.filter((t) => t.dispute?.resolvedAt);
  const resolutionTimesMs = resolved.map((t) => new Date(t.dispute.resolvedAt) - new Date(t.dispute.raisedAt));
  const avgResolutionHours = resolutionTimesMs.length
    ? Number((resolutionTimesMs.reduce((a, b) => a + b, 0) / resolutionTimesMs.length / 3600000).toFixed(1))
    : null;

  const decisionBreakdown = resolved.reduce((acc, t) => {
    const key = t.dispute.decision || 'unresolved';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    totalDisputes: disputed.length,
    disputeRate: totalTrades > 0 ? Number(((disputed.length / totalTrades) * 100).toFixed(2)) : 0,
    resolvedCount: resolved.length,
    openCount: disputed.length - resolved.length,
    avgResolutionHours,
    decisionBreakdown,
  };
}

// --- CSV export --------------------------------------------------------------

function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = c.value(row);
        const str = raw === null || raw === undefined ? '' : String(raw);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

async function exportRevenueCsv() {
  const settlements = await Settlement.find().populate({
    path: 'tradeId',
    select: 'sellerId buyerId quantityKWh totalAmount',
    populate: [{ path: 'sellerId', select: 'firstName lastName' }, { path: 'buyerId', select: 'firstName lastName' }],
  });

  return toCsv(settlements, [
    { label: 'Settlement ID', value: (s) => s._id },
    { label: 'Trade ID', value: (s) => s.tradeId?._id },
    { label: 'Prosumer', value: (s) => (s.tradeId?.sellerId ? `${s.tradeId.sellerId.firstName} ${s.tradeId.sellerId.lastName}` : '') },
    { label: 'Consumer', value: (s) => (s.tradeId?.buyerId ? `${s.tradeId.buyerId.firstName} ${s.tradeId.buyerId.lastName}` : '') },
    { label: 'Prosumer Amount', value: (s) => s.prosumerAmount },
    { label: 'Grid Wheel Fee', value: (s) => s.gridWheelAmount },
    { label: 'Platform Fee', value: (s) => s.platformAmount },
    { label: 'Status', value: (s) => s.status },
    { label: 'Blockchain TX', value: (s) => s.blockchainTxHash || '' },
    { label: 'Date', value: (s) => s.createdAt.toISOString() },
  ]);
}

module.exports = {
  getDashboardMetrics,
  getUserAnalytics,
  getTradeAnalytics,
  getRevenueBreakdown,
  getBlockchainAnalytics,
  getComplianceReport,
  getDisputesReport,
  exportRevenueCsv,
};
