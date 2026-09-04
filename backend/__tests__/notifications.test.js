const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');
const { User, EnergyListing, Trade, TradingSlot, TradeNotification } = require('../models');

const PROSUMER_EMAIL = 'notif-flow-prosumer@example.com';
const CONSUMER_EMAIL = 'notif-flow-consumer@example.com';
const TEST_DATE = '2031-02-10'; // far-future, won't collide with real data
const TEST_HOUR = 11;

let prosumer;
let consumer;
let prosumerToken;
let consumerToken;

function tokenFor(userId, type) {
  return jwt.sign({ id: userId, type }, process.env.JWT_SECRET || 'test-secret');
}

beforeAll(async () => {
  prosumer = new User({
    email: PROSUMER_EMAIL,
    firstName: 'Notif',
    lastName: 'Prosumer',
    type: 'prosumer',
    status: 'ACTIVE',
    emailVerified: true,
    kycVerified: true,
  });
  prosumer.password = 'Str0ng!Pass1';
  await prosumer.save();

  consumer = new User({
    email: CONSUMER_EMAIL,
    firstName: 'Notif',
    lastName: 'Consumer',
    type: 'consumer',
    status: 'ACTIVE',
    emailVerified: true,
    kycVerified: true,
    // Buying now requires real wallet balance (see routes/trades.js,
    // routes/slots.js) — a generous fixture balance, not a Razorpay
    // top-up, since these tests exercise trading logic, not payments.
    walletBalance: 1000,
  });
  consumer.password = 'Str0ng!Pass1';
  await consumer.save();

  prosumerToken = tokenFor(prosumer._id, 'prosumer');
  consumerToken = tokenFor(consumer._id, 'consumer');
});

afterAll(async () => {
  await TradeNotification.deleteMany({ userId: { $in: [prosumer._id, consumer._id] } });
  await TradingSlot.deleteMany({ userId: { $in: [prosumer._id, consumer._id] } });
  await Trade.deleteMany({ $or: [{ sellerId: prosumer._id }, { buyerId: consumer._id }] });
  await EnergyListing.deleteMany({ prosumerId: prosumer._id });
  await User.deleteMany({ email: { $in: [PROSUMER_EMAIL, CONSUMER_EMAIL] } });
});

describe('marketplace trade creation notifies the seller', () => {
  it('creates a notification for the prosumer when their listing is bought', async () => {
    const listing = await EnergyListing.create({
      prosumerId: prosumer._id,
      quantityKWh: 5,
      pricePerKwh: 0.12,
      tradingType: 'dayahead',
      status: 'active',
    });

    const buyRes = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ quantityKWh: 5, tradingType: 'dayahead' });
    expect(buyRes.status).toBe(201);
    expect(buyRes.body.trades).toHaveLength(1);

    // Buyer got the trade synchronously — no notification needed for them.
    const buyerNotifs = await request(app).get('/api/notifications').set('Authorization', `Bearer ${consumerToken}`);
    expect(buyerNotifs.body.length).toBe(0);

    // Seller (prosumer) finds out asynchronously.
    const sellerNotifs = await request(app).get('/api/notifications').set('Authorization', `Bearer ${prosumerToken}`);
    expect(sellerNotifs.status).toBe(200);
    expect(sellerNotifs.body.length).toBe(1);
    expect(sellerNotifs.body[0].counterpartyName).toContain('Notif');
    expect(sellerNotifs.body[0].quantityKWh).toBe(5);
    expect(sellerNotifs.body[0].gridRateSavings).toBeNull(); // seller side, not the buyer

    await EnergyListing.deleteOne({ _id: listing._id });
  });
});

describe('slot matching notifies the waiting party', () => {
  it('notifies the consumer whose earlier buy bid gets matched by a later sell bid', async () => {
    const buyRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ hour: TEST_HOUR, date: TEST_DATE, bidPrice: 0.15, bidQuantity: 3, bidType: 'buy' });
    expect(buyRes.status).toBe(201);
    expect(buyRes.body.matched).toBe(false);

    const sellRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ hour: TEST_HOUR, date: TEST_DATE, bidPrice: 0.1, bidQuantity: 3, bidType: 'sell' });
    expect(sellRes.status).toBe(201);
    expect(sellRes.body.matched).toBe(true);

    // Prosumer placed the bid that triggered the match — already has the
    // result, so this slot match specifically shouldn't have generated a
    // notification for them (they already have one from the earlier
    // marketplace-sale test in this file, hence checking by tradeId rather
    // than an overall count of 0).
    const prosumerNotifs = await request(app).get('/api/notifications').set('Authorization', `Bearer ${prosumerToken}`);
    expect(prosumerNotifs.body.some((n) => n.tradeId === sellRes.body.tradeId)).toBe(false);

    // Consumer's earlier bid got matched asynchronously — gets notified,
    // with a real grid-rate savings figure since they're the buyer.
    const consumerNotifs = await request(app).get('/api/notifications').set('Authorization', `Bearer ${consumerToken}`);
    expect(consumerNotifs.status).toBe(200);
    expect(consumerNotifs.body.length).toBe(1);
    expect(consumerNotifs.body[0].gridRateSavings).toBeGreaterThan(0);
  });
});

describe('PATCH /api/notifications/:id/seen', () => {
  it('marks a notification seen and excludes it from ?unseen=true', async () => {
    const all = await request(app).get('/api/notifications').set('Authorization', `Bearer ${prosumerToken}`);
    expect(all.body.length).toBeGreaterThan(0);
    const id = all.body[0]._id;

    const seenRes = await request(app).patch(`/api/notifications/${id}/seen`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(seenRes.status).toBe(200);
    expect(seenRes.body.seen).toBe(true);

    const unseen = await request(app).get('/api/notifications?unseen=true').set('Authorization', `Bearer ${prosumerToken}`);
    expect(unseen.body.some((n) => n._id === id)).toBe(false);
  });

  it("rejects marking another user's notification seen", async () => {
    const all = await request(app).get('/api/notifications').set('Authorization', `Bearer ${consumerToken}`);
    const id = all.body[0]._id;

    const res = await request(app).patch(`/api/notifications/${id}/seen`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(404);
  });
});
