// emailService is mocked so this test never actually sends mail — it
// asserts the JOB's behaviour: who it selects, that it honours the
// opt-out, and that the unsubscribe route flips the flag.
jest.mock('../services/emailService', () => ({
  isEmailConfigured: () => false,
  sendTradingReminder: jest.fn(async () => ({ delivered: true, fallback: false })),
  sendEmailOtp: jest.fn(),
  sendPasswordResetOtp: jest.fn(),
  sendTicketNotification: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { User } = require('../models');
const { sendTradingReminder } = require('../services/emailService');
const morningEmailJob = require('../jobs/morningEmailJob');

const TAG = 'morning-email-test';
let optedIn;
let optedOut;
let adminUser;

beforeAll(async () => {
  const mk = async (over) => {
    const u = new User(
      Object.assign(
        { firstName: 'Morning', lastName: 'Test', status: 'ACTIVE', emailVerified: true, kycVerified: true },
        over
      )
    );
    u.password = 'Str0ng!Pass1';
    return u.save();
  };
  optedIn = await mk({ email: `${TAG}-in@mtest.io`, type: 'consumer' });
  optedOut = await mk({ email: `${TAG}-out@mtest.io`, type: 'prosumer', dailyEmailOptOut: true });
  // An admin + a PENDING user that must NOT be mailed.
  adminUser = await mk({ email: `${TAG}-admin@mtest.io`, type: 'admin' });
  await mk({ email: `${TAG}-pending@mtest.io`, type: 'consumer', status: 'PENDING' });
});

afterAll(async () => {
  await User.deleteMany({ email: { $regex: `^${TAG}-` } });
});

describe('morningEmailJob.runOnce', () => {
  beforeEach(() => sendTradingReminder.mockClear());

  it('emails ACTIVE consumers/prosumers who have not opted out, and skips the rest', async () => {
    const summary = await morningEmailJob.runOnce({ force: true });
    const mailed = sendTradingReminder.mock.calls.map((c) => c[0].toEmail);
    expect(mailed).toContain(`${TAG}-in@mtest.io`);
    expect(mailed).not.toContain(`${TAG}-out@mtest.io`);
    expect(mailed).not.toContain(`${TAG}-admin@mtest.io`);
    expect(mailed).not.toContain(`${TAG}-pending@mtest.io`);
    expect(summary.sent).toBeGreaterThanOrEqual(1);
  });

  it('every reminder carries marketplace / trade-history / unsubscribe links', async () => {
    await morningEmailJob.runOnce({ force: true });
    const arg = sendTradingReminder.mock.calls.find((c) => c[0].toEmail === `${TAG}-in@mtest.io`)[0];
    expect(arg.marketplaceUrl).toBe(
      'https://p2-p-energy-trading-c6yxjp9xu-om-rajas-projects.vercel.app/marketplace'
    );
    expect(arg.tradeHistoryUrl).toBe(
      'https://p2-p-energy-trading-c6yxjp9xu-om-rajas-projects.vercel.app/trade-history'
    );
    expect(arg.unsubscribeUrl).toContain('/api/notifications/email/unsubscribe?token=');
  });
});

describe('GET /api/notifications/email/unsubscribe', () => {
  it('flips dailyEmailOptOut for a valid purpose-scoped token', async () => {
    const token = jwt.sign({ uid: String(optedIn._id), purpose: 'email-unsub' }, process.env.JWT_SECRET);
    const res = await request(app).get(`/api/notifications/email/unsubscribe?token=${token}`);
    expect(res.status).toBe(200);
    const after = await User.findById(optedIn._id);
    expect(after.dailyEmailOptOut).toBe(true);
    // put it back so the ordering of tests in this file doesn't matter
    await User.findByIdAndUpdate(optedIn._id, { dailyEmailOptOut: false });
  });

  it('rejects a token that is not purpose-scoped for unsubscribe', async () => {
    const wrong = jwt.sign({ id: String(optedIn._id), type: 'consumer' }, process.env.JWT_SECRET);
    const res = await request(app).get(`/api/notifications/email/unsubscribe?token=${wrong}`);
    expect(res.status).toBe(400);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/api/notifications/email/unsubscribe?token=not-a-jwt');
    expect(res.status).toBe(400);
  });
});
