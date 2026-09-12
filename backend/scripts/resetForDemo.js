/**
 * Wipes all trading data so the platform is in a clean, empty state for a
 * fresh demo — every user account is kept exactly as-is (login, role, KYC
 * status, profile), only the trading history/state is cleared.
 *
 * Deletes (all statuses, both trading venues — the live double auction AND
 * the dormant instant-matcher/Buy-Now venues, so nothing stale surfaces if
 * either is re-linked later):
 *   - Trade, Settlement, AuctionOrder, TradingSlot, EnergyListing,
 *     TradeNotification (orphaned the moment its Trade is gone)
 *
 * Wallets are reset only if you pass --reset-wallets (off by default,
 * since it's a separate, more consequential decision than clearing trade
 * history — resetting a balance discards real Razorpay top-up money the
 * user actually paid for). When passed, it resets walletBalance to the
 * schema default (0, not a fabricated "starter" amount — this app has no
 * canonical seeded balance to reset *to*) and clears Transaction (the
 * top-up ledger), since a zeroed balance with old top-up history still
 * showing would be inconsistent.
 *
 * Never touches: User accounts, KYC status, walletAddress, profile fields,
 * admin/support data (Ticket, TicketReply, AdminLog, Announcement,
 * SystemSettings), LoginEvent, MeterData/ForecastData (sensor/forecast
 * history — not trading data, out of scope for a "reset trading" script).
 *
 * Usage:
 *   node backend/scripts/resetForDemo.js                  # prompts, keeps wallets
 *   node backend/scripts/resetForDemo.js --reset-wallets   # prompts, also zeroes wallets
 *   node backend/scripts/resetForDemo.js --yes             # skip the prompt (CI/scripted use)
 */
require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');

const resetWallets = process.argv.includes('--reset-wallets');
const skipConfirm = process.argv.includes('--yes');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const dbName = mongoose.connection.db.databaseName;
  const {
    User,
    Trade,
    Settlement,
    AuctionOrder,
    TradingSlot,
    EnergyListing,
    TradeNotification,
    Transaction,
  } = require('../models');

  const before = {
    users: await User.countDocuments(), // reported, never touched
    trades: await Trade.countDocuments(),
    settlements: await Settlement.countDocuments(),
    auctionOrders: await AuctionOrder.countDocuments(),
    tradingSlots: await TradingSlot.countDocuments(),
    energyListings: await EnergyListing.countDocuments(),
    tradeNotifications: await TradeNotification.countDocuments(),
    transactions: await Transaction.countDocuments(),
    walletsWithBalance: await User.countDocuments({ walletBalance: { $gt: 0 } }),
  };

  console.log(`Target database: ${dbName}`);
  console.log('\nThis will PERMANENTLY DELETE:');
  console.log(`  ${before.trades} Trade document(s)`);
  console.log(`  ${before.settlements} Settlement document(s)`);
  console.log(`  ${before.auctionOrders} AuctionOrder document(s)`);
  console.log(`  ${before.tradingSlots} TradingSlot document(s)`);
  console.log(`  ${before.energyListings} EnergyListing document(s)`);
  console.log(`  ${before.tradeNotifications} TradeNotification document(s)`);
  if (resetWallets) {
    console.log(`  ${before.transactions} Transaction document(s) (--reset-wallets was passed)`);
    console.log(`  walletBalance reset to 0 on ${before.walletsWithBalance} user(s) (--reset-wallets was passed)`);
  } else {
    console.log(`  Wallet balances and Transaction history: KEPT (pass --reset-wallets to clear these too)`);
  }
  console.log(`\nUser accounts: KEPT — all ${before.users} account(s) untouched (login, role, KYC, profile).`);

  if (!skipConfirm) {
    const answer = await ask('\nType RESET (all caps) to confirm, anything else to cancel: ');
    if (answer !== 'RESET') {
      console.log('Cancelled — nothing was deleted.');
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  const results = {
    trades: (await Trade.deleteMany({})).deletedCount,
    settlements: (await Settlement.deleteMany({})).deletedCount,
    auctionOrders: (await AuctionOrder.deleteMany({})).deletedCount,
    tradingSlots: (await TradingSlot.deleteMany({})).deletedCount,
    energyListings: (await EnergyListing.deleteMany({})).deletedCount,
    tradeNotifications: (await TradeNotification.deleteMany({})).deletedCount,
  };

  if (resetWallets) {
    results.transactions = (await Transaction.deleteMany({})).deletedCount;
    const walletReset = await User.updateMany({}, { $set: { walletBalance: 0 } });
    results.walletsReset = walletReset.modifiedCount;
  }

  console.log('\nDeleted:', results);
  console.log(`Users kept: ${before.users}`);
  console.log('\n✅ Demo reset complete - database ready for fresh demo');

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
