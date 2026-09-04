const mongoose = require('mongoose');

// A lightweight "you got matched" notification, generated alongside an
// existing Trade — never a replacement for one, and never a gate on one.
// Both real match sources create trades synchronously already (marketplace
// POST /trades, slot bid matching), so the party who *initiated* the action
// already has the result in their own response; this exists for the OTHER
// party, who found out asynchronously (their listing got bought, or their
// earlier-placed bid got matched by someone else's later bid).
const tradeNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', required: true },
    counterpartyName: { type: String, required: true },
    quantityKWh: { type: Number, required: true },
    pricePerKwh: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    // Only meaningful when userId is the buyer — a real comparison against
    // the same ₹0.15/kWh grid-retail figure used in chat.js/revenueService.js,
    // not a fabricated number. Null for the seller side.
    gridRateSavings: { type: Number, default: null },
    seen: { type: Boolean, default: false },
    seenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tradeNotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('TradeNotification', tradeNotificationSchema);
