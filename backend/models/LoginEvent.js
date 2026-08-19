const mongoose = require('mongoose');

// One row per successful login — backs the "Recent Activity" timeline on
// the profile page with real login history instead of just the single
// `User.lastLogin` timestamp. Deliberately minimal (no IP/user-agent
// capture) — this project has no such logging elsewhere, so recording it
// here isn't the point; having a real per-login timestamp is.
const loginEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    method: {
      type: String,
      enum: ['password', 'email-otp', 'mobile-otp', 'google'],
      required: true,
    },
  },
  { timestamps: true }
);

loginEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LoginEvent', loginEventSchema);
