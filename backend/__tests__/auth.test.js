const request = require('supertest');
const app = require('../server');

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
});
