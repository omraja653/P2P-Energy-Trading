const mongoose = require('mongoose');

const energyListingSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    energyAmountKwh: { type: Number, required: true, min: 0 },
    pricePerKwh: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold', 'cancelled'],
      default: 'available',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EnergyListing', energyListingSchema);
