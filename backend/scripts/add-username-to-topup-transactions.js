/**
 * One-off backfill: adds userName/userEmail to existing Transaction docs
 * created before those fields existed. New transactions already get them
 * at creation time (see routes/wallet.js) — this only needs to run once
 * for whatever top-ups happened before this change.
 *
 * Usage: node backend/scripts/add-username-to-topup-transactions.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { User, Transaction } = require('../models');

async function addUserNamesToTransactions() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);

  // Real query, not the pasted spec's `{ userName: { $exists: false } }`
  // alone — Mongoose would otherwise re-touch every 'topup' doc query
  // matches even if userName is already set to an empty value on a retry;
  // this is still narrow to 'topup' since that's the only type this app
  // actually creates.
  const transactions = await Transaction.find({ userName: { $exists: false }, type: 'topup' });
  console.log(`Found ${transactions.length} transaction(s) without userName`);

  let updated = 0;
  let failed = 0;

  for (const txn of transactions) {
    try {
      // Real field names — this app's User model has firstName/lastName,
      // not a single `name` field (the pasted spec's `user.name` doesn't
      // exist here and would have silently written "undefined").
      const user = await User.findById(txn.userId).select('firstName lastName email');
      if (user) {
        txn.userName = `${user.firstName} ${user.lastName}`.trim();
        txn.userEmail = user.email;
        await txn.save();
        updated++;
        console.log(`✅ Updated: ${txn.userName} — ₹${txn.amount}`);
      } else {
        failed++;
        console.log(`❌ User not found for transaction: ${txn._id}`);
      }
    } catch (err) {
      failed++;
      console.error(`Error updating transaction ${txn._id}:`, err.message);
    }
  }

  console.log('\n✅ MIGRATION COMPLETE');
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);

  await mongoose.disconnect();
}

addUserNamesToTransactions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
