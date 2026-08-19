const { Trade } = require('../models');
const { sendTicketNotification } = require('./emailService');

const POPULATE = [
  { path: 'buyerId', select: 'firstName lastName email' },
  { path: 'sellerId', select: 'firstName lastName email' },
];

async function getTrades({ status, prosumer, consumer, from, to } = {}) {
  const query = {};
  if (status) query.status = status;
  if (prosumer) query.sellerId = prosumer;
  if (consumer) query.buyerId = consumer;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  return Trade.find(query).sort({ createdAt: -1 }).populate(POPULATE);
}

async function getTradeDetail(tradeId) {
  return Trade.findById(tradeId).populate(POPULATE);
}

async function markDisputed(tradeId, reason, raisedBy) {
  const trade = await Trade.findById(tradeId);
  if (!trade) return null;
  if (trade.status === 'disputed') return trade; // already disputed, no-op

  trade.dispute = {
    reason,
    raisedAt: new Date(),
    raisedBy,
    statusBeforeDispute: trade.status,
    decision: null,
    resolutionNotes: undefined,
    resolvedAt: undefined,
    resolvedBy: undefined,
  };
  trade.status = 'disputed';
  await trade.save();
  return trade;
}

// decision: 'approve_trade' (restore prior status), 'refund_consumer' /
// 'refund_both' (marked cancelled — no real payment-reversal system exists
// to actually move money back, so this only records the decision and
// updates status/notes), 'no_action' (restore prior status, no change).
async function resolveDispute(tradeId, decision, notes, resolvedBy) {
  const trade = await Trade.findById(tradeId).populate(POPULATE);
  if (!trade) return null;
  if (trade.status !== 'disputed') return { error: 'Trade is not currently disputed' };

  trade.dispute.decision = decision;
  trade.dispute.resolutionNotes = notes;
  trade.dispute.resolvedAt = new Date();
  trade.dispute.resolvedBy = resolvedBy;

  if (decision === 'refund_consumer' || decision === 'refund_both') {
    trade.status = 'cancelled';
  } else {
    // approve_trade / no_action: restore whatever it was before the dispute.
    trade.status = trade.dispute.statusBeforeDispute || 'settled';
  }

  await trade.save();

  // Notify both parties — best-effort, never fails the resolution itself
  // (sendTicketNotification already swallows its own errors).
  const decisionLabel = decision.replace(/_/g, ' ');
  const body = `The dispute on your trade has been resolved. Decision: ${decisionLabel}. Notes: ${notes}`;
  await Promise.allSettled([
    trade.buyerId?.email && sendTicketNotification({ toEmail: trade.buyerId.email, subject: 'Trade dispute resolved', heading: 'Your trade dispute has been resolved', body }),
    trade.sellerId?.email && sendTicketNotification({ toEmail: trade.sellerId.email, subject: 'Trade dispute resolved', heading: 'Your trade dispute has been resolved', body }),
  ]);

  return trade;
}

module.exports = { getTrades, getTradeDetail, markDisputed, resolveDispute };
