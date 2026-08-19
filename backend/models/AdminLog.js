const mongoose = require('mongoose');

// One row per admin action — the audit trail the spec asks for. Written
// directly by each admin route handler (via adminLogService.logAction)
// rather than generic middleware, since only the handler actually knows
// what changed in human-readable terms.
const adminLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, trim: true }, // e.g. 'user.suspend', 'kyc.approve'
    targetType: { type: String, enum: ['user', 'trade', 'settlement', 'ticket', 'system'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: String, trim: true },
  },
  { timestamps: true }
);

adminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
