const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    trade: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', required: true },
    amountSettled: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    settledTxHash: { type: String, default: null },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settlement', settlementSchema);
