const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

function tokenFor(type) {
  return jwt.sign({ id: 'test-user-id', type }, process.env.JWT_SECRET || 'test-secret');
}

describe('GET /api/admin/stats', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${tokenFor('consumer')}`);
    expect(res.status).toBe(403);
  });

  it('returns real aggregated stats for an admin', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalUsers).toBe('number');
    expect(typeof res.body.totalTrades).toBe('number');
    expect(typeof res.body.totalVolume).toBe('number');
    expect(res.body.usersByType).toBeTruthy();
    expect(Array.isArray(res.body.volumeOverTime)).toBe(true);
    expect(Array.isArray(res.body.recentTrades)).toBe(true);
    expect(res.body.systemHealth.database).toBe('connected');
  });
});
