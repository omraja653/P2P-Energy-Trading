/**
 * One-time cleanup for the Settlement-document bloat found during a live
 * audit (2026-09-11): settlementService.settleTrade() used to create a
 * brand-new Settlement document on every single retry, and
 * settlementScheduler retries every 'matched' trade every 60s forever with
 * no cap. With the relayer wallet out of testnet gas, 13 trades stuck
 * retrying for 6+ hours had produced ~4,800 duplicate 'failed' rows
 * between them (7,507 Settlement documents total). settlementService.js
 * has since been fixed to reuse one Settlement per trade instead of
 * creating a new one each retry — this script only cleans up the historical
 * mess that fix doesn't retroactively remove.
 *
 * Deliberately narrower than a naive "clean up old data" script:
 *
 *  - Deletes ONLY Settlement docs with status:'failed'. A 'failed' record
 *    carries no information beyond "an attempt was made and didn't
 *    succeed" — that fact is fully reconstructable from the linked Trade
 *    still sitting at status:'matched', so nothing is lost.
 *
 *  - Does NOT touch status:'pending' Settlement docs. A 'pending' Settlement
 *    is a live, in-progress record — settleTrade() creates/reuses one at
 *    the START of an attempt, before the on-chain call resolves. Deleting
 *    it out from under a concurrently-running settlement attempt (the
 *    scheduler runs every 60s) would corrupt that attempt's in-memory
 *    reference and is never "orphaned" in the way a stale 'failed' row is.
 *
 *  - Does NOT touch Trade documents, at any age or status. A Trade stuck at
 *    'matched' represents a REAL transaction where the buyer has already
 *    been debited (see jobs/auctionScheduler.js's atomic debit at clearing
 *    time) but the seller has not yet been credited (that only happens at
 *    settlement). Deleting the Trade would permanently erase the record
 *    that this money is owed to the seller, with no way to ever pay it —
 *    the buyer's money would simply vanish from the books. The only real
 *    fix for stuck trades is funding the relayer wallet so settlement can
 *    actually run; deleting the evidence they exist is not a fix, it's
 *    data loss. Refused — not implemented here.
 *
 *  - Does NOT touch AuctionOrder documents. The live database has 7 total
 *    pending orders (3 sell + 4 buy) at the time of this audit — there is
 *    no "thousands of orphaned orders" problem to clean up, and bulk-
 *    deleting a user's still-open order without their action or consent
 *    (cancel) discards real, current intent for no benefit.
 *
 * Usage: node backend/scripts/cleanupOrphanedSettlements.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const { Settlement, Trade, AuctionOrder } = require('../models');

  const before = {
    settlements: await Settlement.countDocuments(),
    settlementsFailed: await Settlement.countDocuments({ status: 'failed' }),
    settlementsPending: await Settlement.countDocuments({ status: 'pending' }),
    settlementsCompleted: await Settlement.countDocuments({ status: 'completed' }),
    trades: await Trade.countDocuments(),
    tradesMatched: await Trade.countDocuments({ status: 'matched' }),
    pendingOrders: await AuctionOrder.countDocuments({ status: 'pending' }),
  };
  console.log('Before cleanup:', before);

  const result = await Settlement.deleteMany({ status: 'failed' });
  console.log(`\nDeleted ${result.deletedCount} 'failed' Settlement documents.`);

  const after = {
    settlements: await Settlement.countDocuments(),
    settlementsFailed: await Settlement.countDocuments({ status: 'failed' }),
    settlementsPending: await Settlement.countDocuments({ status: 'pending' }),
    settlementsCompleted: await Settlement.countDocuments({ status: 'completed' }),
    trades: await Trade.countDocuments(),
    tradesMatched: await Trade.countDocuments({ status: 'matched' }),
    pendingOrders: await AuctionOrder.countDocuments({ status: 'pending' }),
  };
  console.log('\nAfter cleanup:', after);
  console.log(
    `\nNOT touched (by design — see file header): ${after.tradesMatched} matched Trade doc(s), ${after.settlementsPending} pending Settlement doc(s), ${after.pendingOrders} pending AuctionOrder(s).`
  );
  console.log(
    'The matched trades will settle for real once the relayer wallet (0xf16DB4D3cAe7B5F3D98a69AF94B5E91C6dC25cae) has testnet MATIC again — that is the actual fix, not deletion.'
  );

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
