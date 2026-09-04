const { TradeNotification, User } = require('../models');

// Same grid-retail comparison figure used in routes/chat.js and
// services/revenueService.js — one real number, not invented per-caller.
const GRID_PRICE_PER_KWH = 0.15;

/**
 * Notifies `userId` about a trade they didn't just create themselves (the
 * requester in a synchronous flow already has the trade in their own
 * response — this is for the counterparty). `asBuyer` controls whether the
 * grid-rate savings figure is computed (only meaningful for the buyer side).
 */
async function notifyMatch({ userId, counterpartyId, tradeId, quantityKWh, pricePerKwh, totalAmount, asBuyer }) {
  try {
    const counterparty = await User.findById(counterpartyId).select('firstName lastName');
    const gridRateSavings = asBuyer ? Number((quantityKWh * (GRID_PRICE_PER_KWH - pricePerKwh)).toFixed(4)) : null;

    await TradeNotification.create({
      userId,
      tradeId,
      counterpartyName: counterparty ? `${counterparty.firstName} ${counterparty.lastName}` : 'Unknown',
      quantityKWh,
      pricePerKwh,
      totalAmount,
      gridRateSavings,
    });
  } catch (err) {
    // Best-effort — a notification hiccup must never fail the trade itself.
    console.error('Failed to create trade notification:', err.message);
  }
}

async function getNotifications(userId, { unseenOnly } = {}) {
  const query = { userId };
  if (unseenOnly) query.seen = false;
  return TradeNotification.find(query).sort({ createdAt: -1 }).limit(50);
}

async function markSeen(notificationId, userId) {
  return TradeNotification.findOneAndUpdate(
    { _id: notificationId, userId },
    { seen: true, seenAt: new Date() },
    { new: true }
  );
}

module.exports = { notifyMatch, getNotifications, markSeen, GRID_PRICE_PER_KWH };
