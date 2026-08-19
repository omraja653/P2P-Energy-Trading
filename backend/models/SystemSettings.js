const mongoose = require('mongoose');

// Singleton document (always _id: 'singleton') — platform-wide knobs the
// admin Settings page can edit. Defaults match the values already hardcoded
// in settlementService.js at the time this was built (2% platform, 8% grid
// wheeling), not the 9%/8%/83% the spec assumed — real current numbers,
// not fabricated ones.
const systemSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'singleton' },
    tradingHoursEnabled: { type: Boolean, default: false },
    tradingHoursStart: { type: String, default: '06:00' }, // HH:mm, only enforced if tradingHoursEnabled
    tradingHoursEnd: { type: String, default: '22:00' },
    platformFeeRate: { type: Number, default: 0.02, min: 0, max: 0.5 }, // fraction, e.g. 0.02 = 2%
    gridWheelRate: { type: Number, default: 0.08, min: 0, max: 0.5 },
    minTradeKWh: { type: Number, default: 0.1, min: 0 },
    maxTradeKWh: { type: Number, default: 50, min: 0 },
    settlementConfirmationHours: { type: Number, default: 24, min: 1 },
  },
  { timestamps: true }
);

systemSettingsSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findById('singleton');
  if (!doc) doc = await this.create({ _id: 'singleton' });
  return doc;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
