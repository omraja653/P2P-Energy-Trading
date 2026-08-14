const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'EnergyListing', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    energyAmountKwh: { type: Number, required: true, min: 0 },
    pricePerKwh: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'matched', 'settled', 'cancelled'],
      default: 'pending',
    },
    txHash: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trade', tradeSchema);
