const mongoose = require('mongoose');

const energyListingSchema = new mongoose.Schema(
  {
    // The prosumer offering surplus energy for sale.
    prosumerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // How much energy is on offer.
    quantityKWh: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => v > 0,
        message: 'quantityKWh must be greater than 0',
      },
    },
    // $/kWh, bounded to the platform's allowed trading band.
    pricePerKwh: {
      type: Number,
      required: true,
      min: [0.08, 'pricePerKwh must be at least $0.08'],
      max: [0.2, 'pricePerKwh must be at most $0.20'],
    },
    // intraday = same-day near-term trading, dayahead = next-day market.
    tradingType: {
      type: String,
      enum: ['intraday', 'dayahead'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'matched', 'closed'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// A prosumer's own listings, filtered by status (e.g. "my active listings").
energyListingSchema.index({ prosumerId: 1, status: 1 });
// The matching engine's main lookup: open listings for a given market type.
energyListingSchema.index({ status: 1, tradingType: 1 });

module.exports = mongoose.model('EnergyListing', energyListingSchema);
