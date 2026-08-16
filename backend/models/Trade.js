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
    pricePerKwh: {
      type: Number,
      required: true,
      min: [0.08, 'pricePerKwh must be at least $0.08'],
      max: [0.2, 'pricePerKwh must be at most $0.20'],
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
    status: {
      type: String,
      enum: ['matched', 'verified', 'settled', 'cancelled'],
      default: 'matched',
    },
    blockchainTxHash: { type: String, default: null },
    matchedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A user's trades (as seller or buyer) filtered by status.
tradeSchema.index({ sellerId: 1, status: 1 });
tradeSchema.index({ buyerId: 1, status: 1 });
// Look up a trade by its on-chain record.
tradeSchema.index({ blockchainTxHash: 1 });

module.exports = mongoose.model('Trade', tradeSchema);
