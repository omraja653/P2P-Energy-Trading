const request = require('supertest');

jest.mock('../services/smsService', () => ({
  sendMobileOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
}));

const app = require('../server');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const EMAIL = 'profile-flow-user@example.com';

let user;
let token;

function tokenFor(userId, type) {
  return jwt.sign({ id: userId, type }, process.env.JWT_SECRET || 'test-secret');
}

beforeAll(async () => {
  user = new User({
    email: EMAIL,
    firstName: 'Profile',
    lastName: 'Tester',
    type: 'consumer',
    status: 'ACTIVE',
    emailVerified: true,
    mobileNumber: '+15550005555',
  });
  user.password = 'Str0ng!Pass1';
  await user.save();
  token = tokenFor(user._id, 'consumer');
});

afterAll(async () => {
  await User.deleteMany({ email: { $in: [EMAIL] } });
});

describe('GET /api/profile', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('returns the current user profile', async () => {
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(EMAIL);
    expect(res.body.passwordHash).toBeUndefined();
  });
});

describe('PATCH /api/profile', () => {
  it('updates name, bio, and address', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated', lastName: 'Name', bio: 'Solar enthusiast.', address: '123 Grid St' });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Updated');
    expect(res.body.bio).toBe('Solar enthusiast.');
    expect(res.body.address).toBe('123 Grid St');
  });

  it('rejects a bio over 200 characters', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/profile/password', () => {
  it('fails with an incorrect current password', async () => {
    const res = await request(app)
      .patch('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'WrongPass1!', newPassword: 'NewStr0ng!Pass' });
    expect(res.status).toBe(401);
  });

  it('rejects a weak new password', async () => {
    const res = await request(app)
      .patch('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'Str0ng!Pass1', newPassword: 'weak' });
    expect(res.status).toBe(400);
  });

  it('changes the password with the correct current password', async () => {
    const res = await request(app)
      .patch('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'Str0ng!Pass1', newPassword: 'NewStr0ng!Pass2' });
    expect(res.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login-email-password')
      .send({ email: EMAIL, password: 'NewStr0ng!Pass2' });
    expect(login.status).toBe(200);
  });
});

describe('PATCH /api/profile/mobile', () => {
  it('triggers OTP verification and flips mobileVerified false until confirmed', async () => {
    const res = await request(app)
      .patch('/api/profile/mobile')
      .set('Authorization', `Bearer ${token}`)
      .send({ mobileNumber: '+15559998888' });
    expect(res.status).toBe(200);
    expect(res.body.registrationId).toBeTruthy();

    const fresh = await User.findById(user._id).select('+mobileOtp');
    expect(fresh.mobileNumber).toBe('+15559998888');
    expect(fresh.mobileVerified).toBe(false);
    expect(fresh.mobileOtp).toBeTruthy();
  });

  it('rejects an invalid phone format', async () => {
    const res = await request(app)
      .patch('/api/profile/mobile')
      .set('Authorization', `Bearer ${token}`)
      .send({ mobileNumber: '5551234567' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/profile/tickets and /api/profile/activity', () => {
  it('returns arrays (empty is fine for a fresh test user)', async () => {
    const tickets = await request(app).get('/api/profile/tickets').set('Authorization', `Bearer ${token}`);
    expect(tickets.status).toBe(200);
    expect(Array.isArray(tickets.body)).toBe(true);

    const activity = await request(app).get('/api/profile/activity').set('Authorization', `Bearer ${token}`);
    expect(activity.status).toBe(200);
    expect(Array.isArray(activity.body)).toBe(true);
  });
});
