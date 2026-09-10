const mongoose = require('mongoose');

/**
 * A standing order in the periodic double-auction venue
 * (jobs/auctionScheduler.js). Deliberately its OWN collection, separate
 * from TradingSlot — the instant matcher (slotMatchingService) pairs a
 * TradingSlot the moment it's placed, which is exactly the behavior the
 * auction must NOT have (orders have to sit and accumulate until the round
 * closes). Keeping them apart means zero risk of the instant matcher
 * grabbing an auction order, and no `if (auctionMode)` branches threaded
 * through the verified matching path.
 *
 * On a fill the scheduler creates a real Trade (this app's normal
 * sellerId/buyerId/quantityKWh/pricePerKwh/totalAmount schema, status
 * 'matched') and links it here; blockchain + settlement then run through
 * the existing settlementScheduler untouched.
 */
const auctionOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userType: { type: String, enum: ['prosumer', 'consumer'], required: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    // Remaining unfilled quantity. A partially-filled marginal order has
    // this decremented and stays 'pending' for the next round rather than
    // spawning a new order (disclosed simplification, mirrors
    // slotMatchingService's partial-fill handling).
    quantity: {
      type: Number,
      required: true,
      validate: { validator: (v) => v > 0, message: 'quantity must be greater than 0' },
    },
    // Reserve price: the most a BUY will pay / the least a SELL will accept.
    // No trading-band restriction (removed project-wide on request) — only
    // "must be positive".
    pricePerKwh: {
      type: Number,
      required: true,
      validate: { validator: (v) => v > 0, message: 'pricePerKwh must be greater than 0' },
    },
    originalQuantity: { type: Number, required: true },
    filledQuantity: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'matched', 'cancelled'],
      default: 'pending',
    },
    // The auction round number this order was (last) matched in — null while
    // still fully open.
    auctionRound: { type: Number, default: null },
    // Most recent Trade this order contributed to (an order can be filled
    // across more than one round; this points at the last one).
    tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
    matchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The scheduler's per-round query: all still-open orders on one side.
auctionOrderSchema.index({ status: 1, side: 1, createdAt: 1 });
// A user's own order list.
auctionOrderSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('AuctionOrder', auctionOrderSchema);
