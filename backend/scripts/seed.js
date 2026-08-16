/**
 * Seeds the MongoDB Atlas database with demo data so the API/UI have
 * something real to show. Safe to re-run — it wipes and reinserts the
 * 5 collections each time (dev/demo data only, never run against prod).
 *
 * Usage:  npm run seed   (from backend/)
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, MeterData, EnergyListing, Trade, Settlement } = require('../models');
const { PLATFORM_FEE_RATE, GRID_WHEEL_RATE } = require('../services/settlementService');

function fakeWalletAddress() {
  return '0x' + crypto.randomBytes(20).toString('hex');
}

// 15-minute-interval meter readings for the last few hours, in kW.
function buildMeterReadings({ userId, count, baseGenerationKW, baseConsumptionKW }) {
  const readings = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const jitter = () => (Math.random() - 0.5) * 0.6; // +/- 0.3 kW
    readings.push({
      userId,
      timestamp: new Date(now - i * 15 * 60 * 1000),
      generationKW: Math.max(0, Number((baseGenerationKW + jitter()).toFixed(2))),
      consumptionKW: Math.max(0, Number((baseConsumptionKW + jitter()).toFixed(2))),
      temperature: Number((22 + jitter() * 3).toFixed(1)),
      cloudCover: Math.max(0, Math.min(100, Math.round(30 + jitter() * 40))),
      dataQuality: 'good',
    });
  }
  return readings;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — check backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to', mongoose.connection.name);

  console.log('Clearing existing demo data...');
  await Promise.all([
    User.deleteMany({}),
    MeterData.deleteMany({}),
    EnergyListing.deleteMany({}),
    Trade.deleteMany({}),
    Settlement.deleteMany({}),
  ]);

  // --- Users ---------------------------------------------------------
  console.log('Creating users...');

  const admin = new User({
    email: 'admin@energytrading.com',
    firstName: 'Grid',
    lastName: 'Admin',
    type: 'admin',
    kycVerified: true,
  });
  admin.password = 'Admin1234';
  await admin.save();

  const alice = new User({
    email: 'alice.prosumer@example.com',
    firstName: 'Alice',
    lastName: 'Nguyen',
    type: 'prosumer',
    walletAddress: fakeWalletAddress(),
    kycVerified: true,
  });
  alice.password = 'Password123';
  await alice.save();

  const david = new User({
    email: 'david.prosumer@example.com',
    firstName: 'David',
    lastName: 'Okafor',
    type: 'prosumer',
    walletAddress: fakeWalletAddress(),
    kycVerified: true,
  });
  david.password = 'Password123';
  await david.save();

  const bob = new User({
    email: 'bob.consumer@example.com',
    firstName: 'Bob',
    lastName: 'Martins',
    type: 'consumer',
    walletAddress: fakeWalletAddress(),
    kycVerified: false,
  });
  bob.password = 'Password123';
  await bob.save();

  const carol = new User({
    email: 'carol.consumer@example.com',
    firstName: 'Carol',
    lastName: 'Silva',
    type: 'consumer',
    kycVerified: false,
  });
  carol.password = 'Password123';
  await carol.save();

  console.log(`  ${admin.email} (admin)`);
  console.log(`  ${alice.email} / ${david.email} (prosumers)`);
  console.log(`  ${bob.email} / ${carol.email} (consumers)`);

  // --- Meter data ------------------------------------------------------
  console.log('Creating meter readings...');

  await MeterData.insertMany([
    ...buildMeterReadings({ userId: alice._id, count: 8, baseGenerationKW: 4.5, baseConsumptionKW: 1.2 }),
    ...buildMeterReadings({ userId: david._id, count: 8, baseGenerationKW: 3.8, baseConsumptionKW: 1.5 }),
    ...buildMeterReadings({ userId: bob._id, count: 6, baseGenerationKW: 0, baseConsumptionKW: 2.1 }),
    ...buildMeterReadings({ userId: carol._id, count: 6, baseGenerationKW: 0, baseConsumptionKW: 1.6 }),
  ]);

  // --- Energy listings --------------------------------------------------
  console.log('Creating energy listings...');

  const aliceDayAhead = await EnergyListing.create({
    prosumerId: alice._id,
    quantityKWh: 3.5,
    pricePerKwh: 0.14,
    tradingType: 'dayahead',
    status: 'active',
  });

  const aliceIntraday = await EnergyListing.create({
    prosumerId: alice._id,
    quantityKWh: 1.2,
    pricePerKwh: 0.11,
    tradingType: 'intraday',
    status: 'matched', // filled by Trade B below
  });

  const davidDayAhead = await EnergyListing.create({
    prosumerId: david._id,
    quantityKWh: 5,
    pricePerKwh: 0.13,
    tradingType: 'dayahead',
    status: 'active',
  });

  const davidMatched = await EnergyListing.create({
    prosumerId: david._id,
    quantityKWh: 2,
    pricePerKwh: 0.12,
    tradingType: 'dayahead',
    status: 'matched', // filled by Trade A below
  });

  // --- Trades ------------------------------------------------------------
  console.log('Creating trades...');

  const now = Date.now();

  // Trade A: fully settled (David -> Bob), 2 days ago.
  const tradeA = await Trade.create({
    listingId: davidMatched._id,
    sellerId: david._id,
    buyerId: bob._id,
    quantityKWh: davidMatched.quantityKWh,
    pricePerKwh: davidMatched.pricePerKwh,
    totalAmount: Number((davidMatched.quantityKWh * davidMatched.pricePerKwh).toFixed(4)),
    tradingType: davidMatched.tradingType,
    status: 'settled',
    matchedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    verifiedAt: new Date(now - 1.5 * 24 * 60 * 60 * 1000),
    settledAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
    // blockchainTxHash stays null — contracts aren't deployed yet, so this
    // settlement only exists in Mongo, not on-chain.
  });

  // Trade B: meter-verified but not yet settled (Alice -> Carol), 1 hour ago.
  const tradeB = await Trade.create({
    listingId: aliceIntraday._id,
    sellerId: alice._id,
    buyerId: carol._id,
    quantityKWh: aliceIntraday.quantityKWh,
    pricePerKwh: aliceIntraday.pricePerKwh,
    totalAmount: Number((aliceIntraday.quantityKWh * aliceIntraday.pricePerKwh).toFixed(4)),
    tradingType: aliceIntraday.tradingType,
    status: 'verified',
    matchedAt: new Date(now - 3 * 60 * 60 * 1000),
    verifiedAt: new Date(now - 60 * 60 * 1000),
  });

  // --- Settlement (for the one settled trade) -----------------------------
  console.log('Creating settlement...');

  const platformAmount = Number((tradeA.totalAmount * PLATFORM_FEE_RATE).toFixed(4));
  const gridWheelAmount = Number((tradeA.totalAmount * GRID_WHEEL_RATE).toFixed(4));
  const prosumerAmount = Number((tradeA.totalAmount - platformAmount - gridWheelAmount).toFixed(4));

  await Settlement.create({
    tradeId: tradeA._id,
    prosumerAmount,
    gridWheelAmount,
    platformAmount,
    status: 'completed',
    settledAt: tradeA.settledAt,
    T1Date: new Date(tradeA.settledAt.getTime() + 24 * 60 * 60 * 1000),
  });

  console.log('\nSeed complete:');
  console.log('  5 users, 28 meter readings, 4 listings, 2 trades, 1 settlement');
  console.log('\nDemo login (any user): password is "Password123" (admin: "Admin1234")');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
