const mongoose = require('mongoose');

const meterDataSchema = new mongoose.Schema(
  {
    // Which user's smart meter this reading belongs to.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Reading is taken on a 15-minute cadence.
    timestamp: { type: Date, required: true, default: Date.now },
    // Energy drawn from the grid/household load, in kW.
    consumptionKW: {
      type: Number,
      required: true,
      min: [0, 'consumptionKW cannot be negative'],
      default: 0,
    },
    // Energy produced by the user's own generation (e.g. solar), in kW.
    generationKW: {
      type: Number,
      required: true,
      min: [0, 'generationKW cannot be negative'],
      default: 0,
    },
    // Auto-calculated: generationKW - consumptionKW. Positive = exportable
    // surplus a prosumer could list for sale; negative = still drawing power.
    surplusKW: { type: Number },
    // Optional weather context, useful for generation forecasting.
    temperature: { type: Number }, // degrees Celsius
    cloudCover: { type: Number, min: 0, max: 100 }, // percent, 0-100
    // Flags how trustworthy this reading is (e.g. simulator vs. real meter,
    // or a gap that was interpolated).
    dataQuality: {
      type: String,
      enum: ['good', 'estimated', 'missing'],
      default: 'good',
    },
  },
  { timestamps: true }
);

// Compound index: most queries fetch a single user's readings ordered by time.
meterDataSchema.index({ userId: 1, timestamp: 1 });

// Keep surplusKW in sync with generation/consumption on every save.
meterDataSchema.pre('validate', function calculateSurplus(next) {
  this.surplusKW = Number((this.generationKW - this.consumptionKW).toFixed(4));
  next();
});

module.exports = mongoose.model('MeterData', meterDataSchema);
