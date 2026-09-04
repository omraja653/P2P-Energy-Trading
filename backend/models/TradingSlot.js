const mongoose = require('mongoose');

// An hourly-slot bid for intraday trading. On a match, `tradeId` points at
// the real Trade document created for it (see services/slotMatchingService.js) —
// blockchain/settlement status lives there and on Settlement, same as every
// other trade; it isn't duplicated onto the slot.
const tradingSlotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userType: { type: String, enum: ['prosumer', 'consumer'], required: true },
    // Still required (kept for display/record — "placed at 14:00") but no
    // longer load-bearing for matching once `tradingType` is set: see
    // services/slotMatchingService.js#matchSlot. Legacy hourly bids (no
    // tradingType, from the original SlotTrading page) still match strictly
    // by hour, unchanged.
    hour: { type: Number, min: 0, max: 23, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    // Full-day bids (the /bid page) set this; hourly slot bids (the
    // /slots page) leave it unset. Matching branches on its presence rather
    // than duplicating the whole model for what's otherwise the same bid.
    // 'dayahead' (no hyphen) to match Trade.tradingType's existing enum —
    // a mismatched value here would fail Trade.create() validation on match.
    tradingType: { type: String, enum: ['intraday', 'dayahead'] },
    // No upper/lower band — the ₹0.08–₹0.20 trading-band restriction was
    // removed on request; only "must be positive" remains.
    bidPrice: {
      type: Number,
      required: true,
      validate: { validator: (v) => v > 0, message: 'bidPrice must be greater than 0' },
    },
    bidQuantity: {
      type: Number,
      required: true,
      validate: { validator: (v) => v > 0, message: 'bidQuantity must be greater than 0' },
    },
    bidType: { type: String, enum: ['buy', 'sell'], required: true },
    status: { type: String, enum: ['pending', 'matched', 'cancelled'], default: 'pending' },
    matched: { type: Boolean, default: false },
    executedQuantity: { type: Number, default: 0 },
    executedPrice: { type: Number, default: null },
    tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
  },
  { timestamps: true }
);

tradingSlotSchema.index({ date: 1, hour: 1, bidType: 1, status: 1 });
tradingSlotSchema.index({ date: 1, tradingType: 1, bidType: 1, status: 1 });
tradingSlotSchema.index({ userId: 1, date: 1 });
tradingSlotSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('TradingSlot', tradingSlotSchema);
