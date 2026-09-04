const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const revenueService = require('../services/revenueService');
const razorpay = require('../config/razorpay');
const { User, Transaction } = require('../models');
const socketService = require('../services/socket');

const router = express.Router();

// Read-only balance view — no bank account storage, no withdrawal trigger.
// A full withdrawal/bank-account system was explicitly scoped out earlier
// (real security concerns with that design: plaintext account numbers, an
// unauthenticated verification endpoint). This is just real numbers from
// real trades, plus the real stored top-up balance below.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!['prosumer', 'consumer'].includes(req.user.type)) {
      return res.status(403).json({ error: 'Wallet is only available to consumer/prosumer accounts' });
    }
    const [summary, user] = await Promise.all([
      revenueService.getLifetimeSummary(req.user.id, req.user.type),
      User.findById(req.user.id).select('walletBalance'),
    ]);
    res.json({ ...summary, walletBalance: user?.walletBalance ?? 0 });
  } catch (err) {
    next(err);
  }
});

// ---- Razorpay wallet top-up -------------------------------------------------
//
// This is the ONE real, correct use of Razorpay Checkout in this app:
// collecting money FROM the signed-in user INTO GridMate's (test) account
// to top up their own walletBalance. There is deliberately no
// "withdrawal"/payout route — Checkout can't disburse money to a user
// (that's Razorpay's separate Payouts/RazorpayX product, which needs
// business KYC this app doesn't have); a "Withdraw" button wired to
// Checkout would silently charge the user's card instead of paying them,
// so it wasn't built. See config/razorpay.js and Wallet.jsx.
//
// Scope boundary, flagged rather than silently expanded: this only adds to
// walletBalance and displays it — nothing in the trade/purchase flow reads
// or deducts it yet. Wiring "spend your top-up balance on a purchase" into
// routes/trades.js / slotMatchingService.js is real additional scope
// that wasn't asked for here.

router.post('/add-balance', requireAuth, async (req, res, next) => {
  try {
    if (!['prosumer', 'consumer'].includes(req.user.type)) {
      return res.status(403).json({ error: 'Wallet is only available to consumer/prosumer accounts' });
    }
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `topup_${req.user.id}_${Date.now()}`,
    });

    await Transaction.create({
      userId: req.user.id,
      type: 'topup',
      amount,
      orderId: order.id,
      status: 'pending',
    });

    res.json({ orderId: order.id, amount, currency: 'INR' });
  } catch (err) {
    if (err.statusCode) {
      // Razorpay SDK errors carry a statusCode + error.description — surface
      // that instead of a generic 500, same discipline as everywhere else
      // in this app that calls an external API.
      return res.status(err.statusCode).json({ error: err.error?.description || 'Razorpay order creation failed' });
    }
    next(err);
  }
});

router.post('/verify-topup', requireAuth, async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'orderId, paymentId, and signature are required' });
    }

    const transaction = await Transaction.findOne({ orderId, userId: req.user.id });
    if (!transaction) return res.status(404).json({ error: 'No matching top-up order found' });
    if (transaction.status === 'completed') {
      // Already processed (e.g. a duplicate verify call) — return the
      // current balance rather than double-crediting the wallet.
      const user = await User.findById(req.user.id).select('walletBalance');
      return res.json({ success: true, transactionId: transaction._id, newBalance: user.walletBalance });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Signature alone proves the response came from Razorpay for this
    // order/payment pair — also fetch the payment to confirm it was
    // actually captured (not just authorized/pending), same defense in
    // depth the pasted spec called for. Wrapped separately so a Razorpay
    // API error here (e.g. payment not found) marks the transaction
    // failed and returns a clean message instead of falling through to a
    // generic 500 — caught live while testing this against Razorpay's
    // real test API.
    let payment;
    try {
      payment = await razorpay.payments.fetch(paymentId);
    } catch (fetchErr) {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(400).json({ error: 'Could not verify payment with Razorpay. Please contact support.' });
    }
    if (payment.status !== 'captured') {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(400).json({ error: 'Payment not captured' });
    }

    const paidAmount = payment.amount / 100;
    transaction.paymentId = paymentId;
    transaction.status = 'completed';
    await transaction.save();

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: paidAmount } },
      { new: true }
    ).select('walletBalance');

    socketService.emitWalletUpdated(req.user.id, {
      walletBalance: user.walletBalance,
      transaction: { type: 'topup', amount: paidAmount },
    });

    res.json({ success: true, transactionId: transaction._id, newBalance: user.walletBalance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
