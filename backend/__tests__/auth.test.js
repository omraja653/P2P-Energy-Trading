const request = require('supertest');

// Mocked before server.js (and therefore routes/auth.js) is required, so
// tests never depend on real external services: no live Gmail/Twilio
// credentials required, no real SMS sent (which would cost real money
// now that TWILIO_* is configured), and no real Google network call.
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-test-subject-id',
        email: 'auth-flow-google-test@example.com',
        email_verified: true,
        given_name: 'Goog',
        family_name: 'User',
      }),
    }),
  })),
}));
jest.mock('../services/emailService', () => ({
  sendEmailOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  sendPasswordResetOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  isEmailConfigured: () => false,
}));
jest.mock('../services/smsService', () => ({
  sendMobileOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  isSmsConfigured: () => false,
}));

const app = require('../server');
const { User } = require('../models');

const TEST_EMAIL = 'auth-flow-test@example.com';
const TEST_MOBILE = '+15550001111';
const NOMOBILE_EMAIL = 'auth-flow-nomobile@example.com';
const NOMOBILE_ADDED_MOBILE = '+15550002222';
const UNVERIFIED_MOBILE_EMAIL = 'auth-flow-unverified-mobile@example.com';
const UNVERIFIED_MOBILE = '+15550003333';
const PARTIAL_FAIL_EMAIL = 'auth-flow-partial-fail@example.com';
const RESET_EMAIL = 'auth-flow-reset-test@example.com';
const RESET_MOBILE = '+15550004444';
const GOOGLE_TEST_EMAIL = 'auth-flow-google-test@example.com';

// Cleans up whatever this file creates, so repeated runs against the real
// dev database stay idempotent and don't leave test users behind.
afterAll(async () => {
  await User.deleteMany({
    email: {
      $in: [
        TEST_EMAIL,
        NOMOBILE_EMAIL,
        UNVERIFIED_MOBILE_EMAIL,
        PARTIAL_FAIL_EMAIL,
        RESET_EMAIL,
        GOOGLE_TEST_EMAIL,
      ],
    },
  });
});

describe('GET /api/health', () => {
  it('returns backend status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Backend running');
  });
});

describe('POST /api/auth/register', () => {
  it('rejects requests missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

  it('rejects a password that fails the strength requirements', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Test',
      lastName: 'User',
      email: TEST_EMAIL,
      password: 'alllowercase', // no uppercase, digit, or special char
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uppercase/i);
  });

  it('rejects an invalid mobile number when one is provided', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Test',
      lastName: 'User',
      email: TEST_EMAIL,
      mobileNumber: 'not-a-phone-number',
      password: 'Str0ng!Pass',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mobileNumber/i);
  });

  it('rejects a bare national number with no country code (Twilio requires E.164)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Test',
      lastName: 'User',
      email: TEST_EMAIL,
      mobileNumber: '8468810197', // valid digits, but no leading +country code
      password: 'Str0ng!Pass',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mobileNumber/i);
  });

  it('accepts registration with no mobile number at all', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'NoMobile',
      lastName: 'Test',
      email: NOMOBILE_EMAIL,
      password: 'Str0ng!Pass',
    });
    expect(res.status).toBe(201);
    expect(res.body.mobileCollected).toBe(false);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.emailVerified).toBe(false);
  });
});

describe('POST /api/auth/register — partial OTP delivery failures', () => {
  const { sendEmailOtp } = require('../services/emailService');
  const { sendMobileOtp } = require('../services/smsService');

  afterEach(async () => {
    sendEmailOtp.mockResolvedValue({ delivered: false, fallback: true });
    sendMobileOtp.mockResolvedValue({ delivered: false, fallback: true });
    await User.deleteMany({ email: PARTIAL_FAIL_EMAIL });
  });

  // Regression test: a failed SMS used to 502 the whole registration, which
  // left the account created-but-unreachable — retrying hit 409 and the UI
  // never advanced to the OTP screen, permanently locking the user out.
  it('still succeeds when only the SMS fails, and flags it so the user can verify mobile later', async () => {
    sendMobileOtp.mockRejectedValueOnce(new Error("Invalid 'To' Phone Number"));

    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Partial',
      lastName: 'Fail',
      email: PARTIAL_FAIL_EMAIL,
      mobileNumber: '+15550009999',
      password: 'Str0ng!Pass',
    });

    expect(res.status).toBe(201);
    expect(res.body.registrationId).toBeTruthy();
    expect(res.body.mobileCollected).toBe(false); // no usable SMS step
    expect(res.body.warning).toMatch(/SMS/i);

    // The account exists and can still complete email verification.
    const user = await User.findById(res.body.registrationId).select('+emailOtp');
    expect(user.emailOtp).toBeTruthy();
    expect(user.mobileNumber).toBe('+15550009999'); // kept for later verification
  });

  // Email is mandatory, so its failure must roll the account back — otherwise
  // the user is blocked by "already registered" on every retry.
  it('rolls back the account when the email fails, so the user can retry', async () => {
    sendEmailOtp.mockRejectedValueOnce(new Error('SMTP unavailable'));

    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Partial',
      lastName: 'Fail',
      email: PARTIAL_FAIL_EMAIL,
      password: 'Str0ng!Pass',
    });

    expect(res.status).toBe(502);
    expect(await User.findOne({ email: PARTIAL_FAIL_EMAIL })).toBeNull();

    // Retrying with the same email now works rather than 409-ing.
    const retry = await request(app).post('/api/auth/register').send({
      firstName: 'Partial',
      lastName: 'Fail',
      email: PARTIAL_FAIL_EMAIL,
      password: 'Str0ng!Pass',
    });
    expect(retry.status).toBe(201);
  });
});

describe('registration with mobile -> email verification alone activates + logs in', () => {
  let registrationId;
  let sessionToken;

  it('registers with a mobile number', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Flow',
      lastName: 'Test',
      email: TEST_EMAIL,
      mobileNumber: TEST_MOBILE,
      password: 'Str0ng!Pass',
    });
    expect(res.status).toBe(201);
    expect(res.body.mobileCollected).toBe(true);
    registrationId = res.body.registrationId;
  });

  it('blocks email-password login before email verification', async () => {
    const res = await request(app)
      .post('/api/auth/login-email-password')
      .send({ email: TEST_EMAIL, password: 'Str0ng!Pass' });
    expect(res.status).toBe(403);
  });

  it('verifying email alone activates the account and returns a session (mobile still unverified)', async () => {
    const user = await User.findById(registrationId).select('+emailOtp +mobileOtp');
    expect(user).toBeTruthy();

    const emailRes = await request(app)
      .post('/api/auth/verify-email-otp')
      .send({ registrationId, otp: user.emailOtp });
    expect(emailRes.status).toBe(200);
    expect(emailRes.body.status).toBe('ACTIVE'); // email alone activates now
    expect(emailRes.body.token).toBeTruthy();
    expect(emailRes.body.user.mobileVerified).toBe(false);

    sessionToken = emailRes.body.token;

    // Mobile OTP is still sitting there unverified — confirm the mobile
    // step still works whenever the user gets to it.
    const mobileRes = await request(app)
      .post('/api/auth/verify-mobile-otp')
      .send({ registrationId, otp: user.mobileOtp });
    expect(mobileRes.status).toBe(200);
    expect(mobileRes.body.user.mobileVerified).toBe(true);
  });

  it('sets a role and logs in via email+password afterward', async () => {
    const roleRes = await request(app)
      .patch('/api/auth/role')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ type: 'consumer' });
    expect(roleRes.status).toBe(200);
    expect(roleRes.body.user.type).toBe('consumer');

    const loginRes = await request(app)
      .post('/api/auth/login-email-password')
      .send({ email: TEST_EMAIL, password: 'Str0ng!Pass' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.type).toBe('consumer');
    expect(loginRes.body.user.mobileVerified).toBe(true);
  });

  it('logs in via email OTP', async () => {
    const otpReqRes = await request(app).post('/api/auth/request-login-otp').send({ email: TEST_EMAIL });
    expect(otpReqRes.status).toBe(200);

    const user = await User.findOne({ email: TEST_EMAIL }).select('+emailOtp');
    const otpRes = await request(app)
      .post('/api/auth/login-email-otp')
      .send({ email: TEST_EMAIL, otp: user.emailOtp });
    expect(otpRes.status).toBe(200);
    expect(otpRes.body.token).toBeTruthy();
  });

  it('logs in via mobile OTP (now that it is verified)', async () => {
    const otpReqRes = await request(app)
      .post('/api/auth/request-login-otp')
      .send({ mobileNumber: TEST_MOBILE });
    expect(otpReqRes.status).toBe(200);

    const user = await User.findOne({ email: TEST_EMAIL }).select('+mobileOtp');
    const otpRes = await request(app)
      .post('/api/auth/login-mobile-otp')
      .send({ mobileNumber: TEST_MOBILE, otp: user.mobileOtp });
    expect(otpRes.status).toBe(200);
    expect(otpRes.body.token).toBeTruthy();
  });

  it('rejects trading until mobileVerified AND kycVerified are both true, then allows it once they are', async () => {
    const blockedRes = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ quantityKWh: 1, tradingType: 'intraday' });
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.requiresKyc).toBe(true); // mobileVerified is true by now, kyc isn't

    const user = await User.findOne({ email: TEST_EMAIL });
    user.kycVerified = true;
    await user.save();

    const allowedRes = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ quantityKWh: 1, tradingType: 'intraday' });
    expect(allowedRes.status).toBe(201); // passes the gate (no matching listings is fine)
  });
});

describe('POST /api/auth/login-mobile-otp before mobile is verified', () => {
  it('rejects a nonexistent mobile number', async () => {
    const res = await request(app)
      .post('/api/auth/login-mobile-otp')
      .send({ mobileNumber: '+19998887777', otp: '123456' });
    expect(res.status).toBe(401);
  });

  it('rejects a real, correct OTP for a mobile number that exists but is not yet verified', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      firstName: 'Unverified',
      lastName: 'Mobile',
      email: UNVERIFIED_MOBILE_EMAIL,
      mobileNumber: UNVERIFIED_MOBILE,
      password: 'Str0ng!Pass',
    });
    expect(regRes.status).toBe(201);

    // Verify email (mandatory) but deliberately leave mobile unverified.
    const user = await User.findById(regRes.body.registrationId).select('+emailOtp +mobileOtp');
    await request(app)
      .post('/api/auth/verify-email-otp')
      .send({ registrationId: regRes.body.registrationId, otp: user.emailOtp });

    // The OTP itself is correct — the block must come from mobileVerified
    // being false, not from OTP validation.
    const res = await request(app)
      .post('/api/auth/login-mobile-otp')
      .send({ mobileNumber: UNVERIFIED_MOBILE, otp: user.mobileOtp });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not verified/i);
  });
});

describe('POST /api/auth/request-mobile-otp (adding mobile after the fact)', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/auth/request-mobile-otp').send({ mobileNumber: NOMOBILE_ADDED_MOBILE });
    expect(res.status).toBe(401);
  });

  it('lets an authenticated user without a mobile number add and verify one', async () => {
    // First time this user's email gets verified (registered with no
    // mobile number back in the /register describe block above).
    const user = await User.findOne({ email: NOMOBILE_EMAIL }).select('+emailOtp');
    const emailRes = await request(app)
      .post('/api/auth/verify-email-otp')
      .send({ registrationId: user._id, otp: user.emailOtp });
    expect(emailRes.status).toBe(200);
    const token = emailRes.body.token;
    expect(token).toBeTruthy();

    const reqRes = await request(app)
      .post('/api/auth/request-mobile-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ mobileNumber: NOMOBILE_ADDED_MOBILE });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.registrationId).toBeTruthy();

    const fresh = await User.findById(reqRes.body.registrationId).select('+mobileOtp');
    const verifyRes = await request(app)
      .post('/api/auth/verify-mobile-otp')
      .send({ registrationId: reqRes.body.registrationId, otp: fresh.mobileOtp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.mobileVerified).toBe(true);
    expect(verifyRes.body.user.mobileNumber).toBe(NOMOBILE_ADDED_MOBILE);
  });
});

describe('PATCH /api/auth/location', () => {
  it('stores a user location and returns it in the session payload', async () => {
    const user = await User.findOne({ email: TEST_EMAIL });
    const token = require('jsonwebtoken').sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret');

    const res = await request(app)
      .patch('/api/auth/location')
      .set('Authorization', `Bearer ${token}`)
      .send({
        lat: 12.9716,
        lng: 77.5946,
        label: 'Bengaluru, India',
        city: 'Bengaluru',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.location).toMatchObject({
      lat: 12.9716,
      lng: 77.5946,
      label: 'Bengaluru, India',
      city: 'Bengaluru',
    });

    const saved = await User.findById(user._id);
    expect(saved.location.lat).toBe(12.9716);
    expect(saved.location.lng).toBe(77.5946);
  });
});

describe('GET /api/auth/me', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns fresh verification status', async () => {
    const user = await User.findOne({ email: TEST_EMAIL });
    const token = require('jsonwebtoken').sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });
});

describe('forgot-password -> reset-password flow', () => {
  beforeAll(async () => {
    // A fully activated local account to reset the password on.
    const regRes = await request(app).post('/api/auth/register').send({
      firstName: 'Reset',
      lastName: 'Test',
      email: RESET_EMAIL,
      mobileNumber: RESET_MOBILE,
      password: 'Str0ng!Pass',
    });
    const user = await User.findById(regRes.body.registrationId).select('+emailOtp');
    await request(app)
      .post('/api/auth/verify-email-otp')
      .send({ registrationId: regRes.body.registrationId, otp: user.emailOtp });
  });

  it('404s for an email that does not exist', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(404);
  });

  it('rejects reset for a Google-only account (no password to reset)', async () => {
    // Reuses the Google user created later in this file's Google describe
    // block would create ordering coupling — create a dedicated one here.
    const googleUser = await User.create({
      email: 'auth-flow-reset-google@example.com',
      firstName: 'Google',
      lastName: 'Only',
      authProvider: 'google',
      googleId: 'reset-flow-google-id',
      status: 'ACTIVE',
      emailVerified: true,
    });
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'auth-flow-reset-google@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Google/i);
    await User.deleteOne({ _id: googleUser._id });
  });

  it('sends a reset code, rejects a weak new password, then resets and logs in with the new one', async () => {
    const sendRes = await request(app).post('/api/auth/forgot-password').send({ email: RESET_EMAIL });
    expect(sendRes.status).toBe(200);

    const user = await User.findOne({ email: RESET_EMAIL }).select('+resetPasswordOtp');
    expect(user.resetPasswordOtp).toBeTruthy();

    const weakRes = await request(app).post('/api/auth/reset-password').send({
      email: RESET_EMAIL,
      otp: user.resetPasswordOtp,
      newPassword: 'weak',
    });
    expect(weakRes.status).toBe(400);

    const resetRes = await request(app).post('/api/auth/reset-password').send({
      email: RESET_EMAIL,
      otp: user.resetPasswordOtp,
      newPassword: 'N3w!Passw0rd',
    });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.token).toBeTruthy(); // auto-logged-in

    // Old password no longer works, new one does.
    const oldLogin = await request(app)
      .post('/api/auth/login-email-password')
      .send({ email: RESET_EMAIL, password: 'Str0ng!Pass' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login-email-password')
      .send({ email: RESET_EMAIL, password: 'N3w!Passw0rd' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a reused/expired reset code on a second attempt', async () => {
    const sendRes = await request(app).post('/api/auth/forgot-password').send({ email: RESET_EMAIL });
    expect(sendRes.status).toBe(200);
    const user = await User.findOne({ email: RESET_EMAIL }).select('+resetPasswordOtp');

    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: RESET_EMAIL, otp: user.resetPasswordOtp, newPassword: 'Anoth3r!Pass' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: RESET_EMAIL, otp: user.resetPasswordOtp, newPassword: 'YetAnoth3r!Pass' });
    expect(second.status).toBe(400);
  });
});

describe('POST /api/auth/google', () => {
  it('returns 503 when Google login is not configured', async () => {
    const original = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    try {
      const res = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
      expect(res.status).toBe(503);
    } finally {
      if (original) process.env.GOOGLE_CLIENT_ID = original;
    }
  });

  it('auto-creates a user with no role and requiresMobileVerification: true', async () => {
    const original = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'fake-client-id-for-tests';
    try {
      const res = await request(app).post('/api/auth/google').send({ idToken: 'fake-valid-token' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe(GOOGLE_TEST_EMAIL);
      expect(res.body.user.type).toBeNull();
      expect(res.body.requiresMobileVerification).toBe(true);
    } finally {
      if (original) process.env.GOOGLE_CLIENT_ID = original;
      else delete process.env.GOOGLE_CLIENT_ID;
    }
  });
});
