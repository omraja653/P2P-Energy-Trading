const Razorpay = require('razorpay');

// Test-mode credentials only — see .env.example. Wallet top-up is the only
// real use case wired to this (see routes/wallet.js): Razorpay Checkout
// collects money FROM the signed-in user INTO this account; it cannot pay
// a user out (that needs the separate RazorpayX Payouts product, which
// requires business KYC this app doesn't have) — so there's no
// "withdrawal" route here, deliberately.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpay;
