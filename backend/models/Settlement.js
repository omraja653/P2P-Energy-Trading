const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', required: true },
    // Payment split of the trade's totalAmount across three parties:
    // the prosumer (seller's payout), the grid operator (wheeling/transport
    // fee for using the grid), and the platform (service fee).
    prosumerAmount: { type: Number, required: true, min: [0, 'prosumerAmount cannot be negative'] },
    gridWheelAmount: { type: Number, required: true, min: [0, 'gridWheelAmount cannot be negative'] },
    platformAmount: { type: Number, required: true, min: [0, 'platformAmount cannot be negative'] },
    blockchainTxHash: { type: String, default: null },
    settledAt: { type: Date, default: null },
    // T+1 settlement due date (trade date + 1 day), per standard energy
    // market settlement cycles.
    T1Date: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

settlementSchema.index({ tradeId: 1 });
settlementSchema.index({ blockchainTxHash: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
