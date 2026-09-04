const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');
const { User, Trade, TradingSlot } = require('../models');

const PROSUMER_EMAIL = 'advanced-flow-prosumer@example.com';
const CONSUMER_EMAIL = 'advanced-flow-consumer@example.com';
const TEST_DATE = '2030-01-15'; // far-future date, won't collide with real trading data
const TEST_MONTH = '2030-01';
const TEST_HOUR = 14;

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
    firstName: 'Advanced',
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
    firstName: 'Advanced',
    lastName: 'Consumer',
    type: 'consumer',
    status: 'ACTIVE',
    emailVerified: true,
    kycVerified: true,
    // Buy-bid placement now requires real wallet balance (see
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
  await TradingSlot.deleteMany({ userId: { $in: [prosumer._id, consumer._id] } });
  await Trade.deleteMany({ $or: [{ sellerId: prosumer._id }, { buyerId: consumer._id }] });
  await User.deleteMany({ email: { $in: [PROSUMER_EMAIL, CONSUMER_EMAIL] } });
});

describe('GET /api/forecasting/:date', () => {
  it('requires auth', async () => {
    const res = await request(app).get(`/api/forecasting/${TEST_DATE}`);
    expect(res.status).toBe(401);
  });

  it('rejects a malformed date', async () => {
    const res = await request(app).get('/api/forecasting/not-a-date').set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(400);
  });

  it('generates a 24-hour prosumer forecast and caches it for the same day', async () => {
    const res = await request(app).get(`/api/forecasting/${TEST_DATE}`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.hourly).toHaveLength(24);
    expect(res.body.userType).toBe('prosumer');
    expect(typeof res.body.peakHour).toBe('number');

    const second = await request(app).get(`/api/forecasting/${TEST_DATE}`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(second.body._id).toBe(res.body._id); // same cached row, not regenerated
  });

  it('generates a consumer forecast independently of the prosumer one', async () => {
    const res = await request(app).get(`/api/forecasting/${TEST_DATE}`).set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userType).toBe('consumer');
  });
});

describe('POST /api/slots/bid', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/slots/bid').send({});
    expect(res.status).toBe(401);
  });

  it('rejects a consumer placing a sell bid', async () => {
    const res = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ hour: TEST_HOUR, date: TEST_DATE, bidPrice: 0.12, bidQuantity: 5, bidType: 'sell' });
    expect(res.status).toBe(403);
  });

  it('rejects a zero or negative price (the ₹0.08-₹0.20 band restriction was removed on request)', async () => {
    const res = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ hour: TEST_HOUR, date: TEST_DATE, bidPrice: 0, bidQuantity: 5, bidType: 'sell' });
    expect(res.status).toBe(400);
  });

  it('accepts a price outside the old ₹0.08-₹0.20 band', async () => {
    const res = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ hour: 22, date: TEST_DATE, bidPrice: 5, bidQuantity: 1, bidType: 'sell' });
    expect(res.status).toBe(201);
    expect(res.body.bidPrice).toBe(5);
  });

  it('matches a sell bid against a waiting buy bid and creates a real Trade', async () => {
    const buyRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ hour: TEST_HOUR, date: TEST_DATE, bidPrice: 0.15, bidQuantity: 10, bidType: 'buy' });
    expect(buyRes.status).toBe(201);
    expect(buyRes.body.matched).toBe(false);

    const sellRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ hour: TEST_HOUR, date: TEST_DATE, bidPrice: 0.1, bidQuantity: 8, bidType: 'sell' });
    expect(sellRes.status).toBe(201);
    expect(sellRes.body.matched).toBe(true);
    expect(sellRes.body.executedQuantity).toBe(8); // min(10, 8)
    expect(sellRes.body.executedPrice).toBeCloseTo(0.125, 4); // midpoint of 0.15/0.10
    expect(sellRes.body.tradeId).toBeTruthy();

    const trade = await Trade.findById(sellRes.body.tradeId);
    expect(trade).toBeTruthy();
    expect(String(trade.sellerId)).toBe(String(prosumer._id));
    expect(String(trade.buyerId)).toBe(String(consumer._id));
    expect(trade.quantityKWh).toBe(8);
    expect(trade.tradingType).toBe('intraday');
    expect(trade.status).toBe('matched');
  });

  it('leaves a non-overlapping bid unmatched', async () => {
    const res = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ hour: 20, date: TEST_DATE, bidPrice: 0.19, bidQuantity: 5, bidType: 'sell' });
    expect(res.status).toBe(201);
    expect(res.body.matched).toBe(false);
  });
});

describe('GET /api/slots/date/:date and /mine/:date', () => {
  it('lists all slots for a date', async () => {
    const res = await request(app).get(`/api/slots/date/${TEST_DATE}`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("scopes /mine to the caller's own bids only", async () => {
    const res = await request(app).get(`/api/slots/mine/${TEST_DATE}`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((s) => String(s.userId) === String(prosumer._id))).toBe(true);
  });

  it("shows a prosumer's sell bid to a consumer (the actual reported bug: no user-type filtering)", async () => {
    const bidDate = '2032-05-05';
    const sellRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ tradingType: 'intraday', date: bidDate, bidQuantity: 3, bidPrice: 0.13, bidType: 'sell' });
    expect(sellRes.body.matched).toBe(false);

    const consumerView = await request(app)
      .get(`/api/slots/date/${bidDate}?bidType=sell`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(consumerView.status).toBe(200);
    expect(consumerView.body.some((b) => b._id === sellRes.body._id)).toBe(true);
    // Populated bidder name — needed for the "Prosumer: X" card display.
    expect(consumerView.body.find((b) => b._id === sellRes.body._id).userId.firstName).toBeTruthy();

    // Once matched, it must stop showing as available — the other real bug
    // fixed here: getSlotsByDate used to return every status, not just
    // 'pending'.
    await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ tradingType: 'intraday', date: bidDate, bidQuantity: 3, bidPrice: 0.13, bidType: 'buy' });

    const afterMatch = await request(app)
      .get(`/api/slots/date/${bidDate}?bidType=sell`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(afterMatch.body.some((b) => b._id === sellRes.body._id)).toBe(false);
  });
});

describe('GET /api/revenue/:month', () => {
  it('requires auth', async () => {
    const res = await request(app).get(`/api/revenue/${TEST_MONTH}`);
    expect(res.status).toBe(401);
  });

  it('rejects a malformed month', async () => {
    const res = await request(app).get('/api/revenue/2030').set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(400);
  });

  it('returns real numbers (empty for a matched-but-not-verified trade)', async () => {
    // The matched trade from the slot test above isn't 'verified'/'settled'
    // yet, so it correctly does NOT show up as realized revenue.
    const res = await request(app).get(`/api/revenue/${TEST_MONTH}`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalTrades).toBe(0);
    expect(res.body.totalEarnings).toBe(0);
  });

  it('counts a verified trade as real prosumer earnings', async () => {
    await Trade.create({
      sellerId: prosumer._id,
      buyerId: consumer._id,
      quantityKWh: 4,
      pricePerKwh: 0.12,
      totalAmount: 0.48,
      tradingType: 'intraday',
      status: 'verified',
      createdAt: new Date(`${TEST_MONTH}-10T14:00:00.000Z`),
    });

    const res = await request(app).get(`/api/revenue/${TEST_MONTH}`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalTrades).toBe(1);
    expect(res.body.totalEarnings).toBeCloseTo(0.48, 2);
    expect(res.body.bestHour).toBe(14);
  });
});

describe('POST /api/slots/bid — full-day (no hour) bids', () => {
  it('places a full-day bid without requiring an hour', async () => {
    const res = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ tradingType: 'dayahead', bidQuantity: 6, bidPrice: 0.09, bidType: 'sell' });
    expect(res.status).toBe(201);
    expect(res.body.tradingType).toBe('dayahead');
    expect(res.body.matched).toBe(false);

    // Left pending, this would silently absorb a later test's intended
    // match (same price ties get picked in insertion order) — clean it up.
    await request(app).post(`/api/slots/${res.body._id}/cancel`).set('Authorization', `Bearer ${prosumerToken}`);
  });

  it('matches full-day bids by date+tradingType regardless of hour, and tags the Trade correctly', async () => {
    const sellRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ tradingType: 'intraday', bidQuantity: 5, bidPrice: 0.1, bidType: 'sell' });
    expect(sellRes.body.matched).toBe(false);

    const buyRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ tradingType: 'intraday', bidQuantity: 5, bidPrice: 0.14, bidType: 'buy' });
    expect(buyRes.status).toBe(201);
    expect(buyRes.body.matched).toBe(true);
    expect(buyRes.body.tradeId).toBeTruthy();

    const trade = await Trade.findById(buyRes.body.tradeId);
    expect(trade.tradingType).toBe('intraday'); // not the literal 'day-ahead' from the pasted spec
  });

  it('does not match a full-day bid against an hourly slot bid (different pools)', async () => {
    const hourlySell = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ hour: 3, date: TEST_DATE, bidPrice: 0.09, bidQuantity: 2, bidType: 'sell' });
    expect(hourlySell.body.matched).toBe(false);

    const fullDayBuy = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ tradingType: 'intraday', date: TEST_DATE, bidQuantity: 2, bidPrice: 0.15, bidType: 'buy' });
    // Same date, prices overlap — but the hourly sell has no tradingType
    // set, so it's outside the full-day matching pool.
    expect(fullDayBuy.body.matched).toBe(false);

    // Both left pending — clean up so they can't interfere with later tests.
    await request(app).post(`/api/slots/${hourlySell.body._id}/cancel`).set('Authorization', `Bearer ${prosumerToken}`);
    await request(app).post(`/api/slots/${fullDayBuy.body._id}/cancel`).set('Authorization', `Bearer ${consumerToken}`);
  });
});

describe('POST /api/slots/:id/cancel', () => {
  it('cancels a pending bid', async () => {
    const bidRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ tradingType: 'dayahead', bidQuantity: 9, bidPrice: 0.08, bidType: 'sell' });
    expect(bidRes.body.matched).toBe(false);

    const cancelRes = await request(app)
      .post(`/api/slots/${bidRes.body._id}/cancel`)
      .set('Authorization', `Bearer ${prosumerToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');
  });

  it('rejects cancelling a matched bid', async () => {
    const sellRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ tradingType: 'dayahead', bidQuantity: 1, bidPrice: 0.09, bidType: 'sell' });
    await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ tradingType: 'dayahead', bidQuantity: 1, bidPrice: 0.15, bidType: 'buy' });

    const res = await request(app).post(`/api/slots/${sellRes.body._id}/cancel`).set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(400);
  });

  it("rejects cancelling another user's bid", async () => {
    const bidRes = await request(app)
      .post('/api/slots/bid')
      .set('Authorization', `Bearer ${prosumerToken}`)
      .send({ tradingType: 'dayahead', bidQuantity: 1, bidPrice: 0.08, bidType: 'sell' });

    const res = await request(app).post(`/api/slots/${bidRes.body._id}/cancel`).set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/slots/mine/active', () => {
  it("returns only the caller's own pending bids, across dates", async () => {
    const res = await request(app).get('/api/slots/mine/active').set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((b) => b.status === 'pending')).toBe(true);
  });
});

describe('GET /api/dashboard', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it("returns tomorrow's forecast and recent activity", async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.forecast.hourly).toHaveLength(24);
    expect(Array.isArray(res.body.recentActivity)).toBe(true);
    expect(res.body.recentActivity.length).toBeLessThanOrEqual(3);
  });
});

describe('GET /api/wallet', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/wallet');
    expect(res.status).toBe(401);
  });

  it('returns lifetime prosumer earnings, including the earlier verified trade', async () => {
    const res = await request(app).get('/api/wallet').set('Authorization', `Bearer ${prosumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userType).toBe('prosumer');
    expect(res.body.balance).toBeGreaterThanOrEqual(0.48); // from the verified-trade test above
    expect(typeof res.body.pending).toBe('number');
  });

  it('returns lifetime consumer savings and amount spent', async () => {
    const res = await request(app).get('/api/wallet').set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userType).toBe('consumer');
    expect(typeof res.body.balance).toBe('number');
    expect(typeof res.body.totalSpent).toBe('number');
  });
});
