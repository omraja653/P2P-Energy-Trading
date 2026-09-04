const mongoose = require('mongoose');

// One cached forecast per user per calendar day. Regenerated (see
// forecastService.getForecast) whenever there's no row yet for that day —
// deterministic pattern + light randomness, not a trained model (see
// forecastService.js for why "AI" here means "shaped heuristic curve").
const forecastDataSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userType: { type: String, enum: ['prosumer', 'consumer'], required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    hourly: [
      {
        _id: false,
        hour: { type: Number, min: 0, max: 23, required: true },
        forecast: { type: Number, required: true }, // kWh
        confidence: { type: Number, min: 0, max: 100, required: true },
        recommendation: { type: String, required: true },
      },
    ],
    peakHour: { type: Number, min: 0, max: 23 },
    totalForecast: { type: Number, required: true },
  },
  { timestamps: true }
);

forecastDataSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ForecastData', forecastDataSchema);
