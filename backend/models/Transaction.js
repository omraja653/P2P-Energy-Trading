const mongoose = require('mongoose');

// Real Razorpay wallet top-ups only — 'topup' is the only type this app
// actually creates (see routes/wallet.js). The pasted spec this was built
// from also listed 'withdrawal'/'payment' types, but those map to flows
// this app doesn't have: there's no payout-to-bank-account capability
// (Razorpay Checkout can't do that — see config/razorpay.js), and no
// "amount owed" a consumer pays off (trades settle automatically through
// the matching engine, not an invoice). Kept the enum narrow rather than
// including types nothing ever sets.
const TYPES = ['topup'];
const STATUSES = ['pending', 'completed', 'failed'];

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    orderId: { type: String, required: true },
    paymentId: { type: String },
    status: { type: String, enum: STATUSES, default: 'pending' },
    method: { type: String, default: 'razorpay' },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.TYPES = TYPES;
module.exports.STATUSES = STATUSES;
