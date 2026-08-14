const mongoose = require('mongoose');

const meterDataSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    meterId: { type: String, required: true },
    energyProducedKwh: { type: Number, default: 0 },
    energyConsumedKwh: { type: Number, default: 0 },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MeterData', meterDataSchema);
