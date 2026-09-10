const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema(
  {
    // The listing this trade was matched against (optional — kept for
    // traceability back to the original offer; not part of the core spec).
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnergyListing' },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quantityKWh: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => v > 0,
        message: 'quantityKWh must be greater than 0',
      },
    },
    // No upper/lower band on the trade's own price — bids (services/slotMatchingService.js)
    // no longer enforce one either, so a matched executedPrice outside the
    // old ₹0.08-₹0.20 band must still be storable here. EnergyListing (the
    // Marketplace listing side) keeps its own band independently.
    pricePerKwh: {
      type: Number,
      required: true,
      validate: { validator: (v) => v > 0, message: 'pricePerKwh must be greater than 0' },
    },
    // quantityKWh * pricePerKwh, snapshotted at match time.
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'totalAmount cannot be negative'],
    },
    tradingType: {
      type: String,
      enum: ['intraday', 'dayahead'],
      required: true,
    },
    // Lifecycle: matched (just paired) -> verified (meter data confirms
    // delivery) -> settled (payment split executed) -> cancelled.
    // 'disputed' is an admin-only side-branch (PATCH /api/admin/trades/:id/dispute)
    // that can be raised from any non-terminal status and resolved back to
    // settled/cancelled by an admin decision.
    status: {
      type: String,
      enum: ['matched', 'verified', 'settled', 'cancelled', 'disputed'],
      default: 'matched',
    },
    blockchainTxHash: { type: String, default: null },
    // Set only on trades created by the double-auction venue
    // (jobs/auctionScheduler.js). `auctionRound` is the round number it
    // cleared in; `clearingPrice` is the single uniform price every trade
    // in that round settled at (equal to pricePerKwh for these — kept as a
    // distinct field so the UI can label it "clearing price" and so a
    // future non-uniform mechanism wouldn't have to overload pricePerKwh).
    // null on every instant-matched / listing-matched trade.
    auctionRound: { type: Number, default: null },
    clearingPrice: { type: Number, default: null },
    matchedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
    // Dispute fields — only meaningful once status has been 'disputed' at
    // least once. `statusBeforeDispute` lets a resolution restore the prior
    // status when the decision is "no action needed".
    dispute: {
      reason: { type: String, trim: true },
      raisedAt: { type: Date },
      raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      statusBeforeDispute: { type: String },
      decision: {
        type: String,
        enum: ['approve_trade', 'refund_consumer', 'refund_both', 'no_action', null],
        default: null,
      },
      resolutionNotes: { type: String, trim: true },
      resolvedAt: { type: Date },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true }
);

// A user's trades (as seller or buyer) filtered by status.
tradeSchema.index({ sellerId: 1, status: 1 });
tradeSchema.index({ buyerId: 1, status: 1 });
// Look up a trade by its on-chain record.
tradeSchema.index({ blockchainTxHash: 1 });

module.exports = mongoose.model('Trade', tradeSchema);
