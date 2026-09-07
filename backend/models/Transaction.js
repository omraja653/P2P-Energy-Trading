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
    // Denormalized snapshot of the user's name/email at the time of the
    // transaction — a deliberate exception to how the rest of this app
    // handles a user reference (everywhere else populates userId live
    // rather than copying name fields, e.g. Trade/TicketReply). Chosen
    // here because a financial transaction record is an audit log: it
    // should keep showing who it was for even if that person later
    // renames their account, not silently rewrite history. Real values,
    // not fabricated — User has firstName/lastName, not a single `name`
    // field, so this is `${firstName} ${lastName}`, not `user.name`
    // (which doesn't exist on this app's User model).
    userName: { type: String },
    userEmail: { type: String },
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
