const request = require('supertest');

jest.mock('../services/emailService', () => ({
  sendEmailOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  sendPasswordResetOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  sendTicketNotification: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  isEmailConfigured: () => false,
}));
jest.mock('../services/smsService', () => ({
  sendMobileOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  isSmsConfigured: () => false,
}));

const app = require('../server');
const jwt = require('jsonwebtoken');
const { User, Trade, AdminLog } = require('../models');

const ADMIN_EMAIL = 'admin-flow-test@example.com';
const TARGET_EMAIL = 'admin-flow-target@example.com';

let admin;
let target;
let adminToken;

function tokenFor(userId, type) {
  return jwt.sign({ id: userId, type }, process.env.JWT_SECRET || 'test-secret');
}

beforeAll(async () => {
  admin = new User({ email: ADMIN_EMAIL, firstName: 'Admin', lastName: 'Flow', type: 'admin', status: 'ACTIVE', emailVerified: true });
  admin.password = 'Str0ng!Pass1';
  await admin.save();

  target = new User({
    email: TARGET_EMAIL,
    firstName: 'Target',
    lastName: 'User',
    type: 'consumer',
    status: 'ACTIVE',
    emailVerified: true,
    kycVerified: false,
  });
  target.password = 'Str0ng!Pass1';
  await target.save();

  adminToken = tokenFor(admin._id, 'admin');
});

afterAll(async () => {
  await Trade.deleteMany({ $or: [{ sellerId: target._id }, { buyerId: target._id }] });
  await AdminLog.deleteMany({ adminId: admin._id });
  await User.deleteMany({ email: { $in: [ADMIN_EMAIL, TARGET_EMAIL] } });
});

describe('admin auth gate', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${tokenFor(target._id, 'consumer')}`);
    expect(res.status).toBe(403);
  });
});

describe('user management', () => {
  it('lists users with filters', async () => {
    const res = await request(app).get('/api/admin/users?role=consumer').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((u) => u.email === TARGET_EMAIL)).toBe(true);
  });

  it('returns user detail with trade history', async () => {
    const res = await request(app).get(`/api/admin/users/${target._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TARGET_EMAIL);
    expect(Array.isArray(res.body.recentTrades)).toBe(true);
  });

  it('manually verifies email and mobile, and logs both actions', async () => {
    const emailRes = await request(app).patch(`/api/admin/users/${target._id}/verify-email`).set('Authorization', `Bearer ${adminToken}`);
    expect(emailRes.status).toBe(200);
    expect(emailRes.body.emailVerified).toBe(true);

    const mobileRes = await request(app).patch(`/api/admin/users/${target._id}/verify-mobile`).set('Authorization', `Bearer ${adminToken}`);
    expect(mobileRes.status).toBe(200);
    expect(mobileRes.body.mobileVerified).toBe(true);

    const logs = await AdminLog.find({ targetId: target._id });
    expect(logs.some((l) => l.action === 'user.verify-email')).toBe(true);
    expect(logs.some((l) => l.action === 'user.verify-mobile')).toBe(true);
  });

  it('suspends a user, which then blocks their login', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${target._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUSPENDED');

    const login = await request(app)
      .post('/api/auth/login-email-password')
      .send({ email: TARGET_EMAIL, password: 'Str0ng!Pass1' });
    expect(login.status).toBe(403);

    // Reactivate so later tests in this file aren't affected.
    await request(app).patch(`/api/admin/users/${target._id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'ACTIVE' });
  });
});

describe('KYC management', () => {
  it('lists the pending KYC queue', async () => {
    const res = await request(app).get('/api/admin/kyc?status=pending').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((u) => u.email === TARGET_EMAIL)).toBe(true);
  });

  it('approves KYC', async () => {
    const res = await request(app).patch(`/api/admin/kyc/${target._id}/approve`).set('Authorization', `Bearer ${adminToken}`).send({ notes: 'Looks good' });
    expect(res.status).toBe(200);
    expect(res.body.kycVerified).toBe(true);
  });

  it('rejects KYC and requires a reason', async () => {
    const noReason = await request(app).patch(`/api/admin/kyc/${target._id}/reject`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(noReason.status).toBe(400);

    const res = await request(app)
      .patch(`/api/admin/kyc/${target._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Address mismatch' });
    expect(res.status).toBe(200);
    expect(res.body.kycVerified).toBe(false);
  });
});

describe('trade dispute management', () => {
  let trade;

  beforeAll(async () => {
    trade = await Trade.create({
      sellerId: admin._id,
      buyerId: target._id,
      quantityKWh: 2,
      pricePerKwh: 0.12,
      totalAmount: 0.24,
      tradingType: 'dayahead',
      status: 'settled',
      settledAt: new Date(),
    });
  });

  it('marks a trade as disputed', async () => {
    const res = await request(app)
      .patch(`/api/admin/trades/${trade._id}/dispute`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Consumer says energy was never delivered' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('disputed');
    expect(res.body.dispute.statusBeforeDispute).toBe('settled');
  });

  it('resolves the dispute and restores status on approve_trade', async () => {
    const res = await request(app)
      .patch(`/api/admin/trades/${trade._id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approve_trade', notes: 'Meter data confirms delivery' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('settled');
    expect(res.body.dispute.decision).toBe('approve_trade');
  });

  it('rejects an invalid decision', async () => {
    await request(app).patch(`/api/admin/trades/${trade._id}/dispute`).set('Authorization', `Bearer ${adminToken}`).send({ reason: 'again' });
    const res = await request(app)
      .patch(`/api/admin/trades/${trade._id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'not-a-real-decision', notes: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('platform metrics', () => {
  it('returns dashboard metrics with real numbers', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalUsers).toBe('number');
    expect(typeof res.body.activeProsumers).toBe('number');
    expect(typeof res.body.activeConsumers).toBe('number');
  });

  it('returns user growth analytics', async () => {
    const res = await request(app).get('/api/admin/analytics/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.growth)).toBe(true);
  });

  it('returns revenue breakdown', async () => {
    const res = await request(app).get('/api/admin/analytics/revenue').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
  });
});

describe('audit log', () => {
  it('recorded every mutating action above', async () => {
    const res = await request(app).get('/api/admin/logs').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const actions = res.body.map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['user.verify-email', 'kyc.approve', 'trade.dispute']));
  });
});

describe('system', () => {
  it('returns real system health signals', async () => {
    const res = await request(app).get('/api/admin/system/health').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });

  it('gets and updates platform settings', async () => {
    const get = await request(app).get('/api/admin/system/settings').set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(typeof get.body.platformFeeRate).toBe('number');

    const patch = await request(app)
      .patch('/api/admin/system/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ platformFeeRate: 0.03 });
    expect(patch.status).toBe(200);
    expect(patch.body.platformFeeRate).toBe(0.03);

    // Restore default so other tests/dev aren't affected.
    await request(app).patch('/api/admin/system/settings').set('Authorization', `Bearer ${adminToken}`).send({ platformFeeRate: 0.02 });
  });
});
