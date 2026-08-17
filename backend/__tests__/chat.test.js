const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

function authHeader() {
  const token = jwt.sign({ id: 'test-user', type: 'consumer' }, process.env.JWT_SECRET || 'test-secret');
  return `Bearer ${token}`;
}

describe('POST /api/chat', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects requests missing a message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 503 when OPENAI_API_KEY is not configured', async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', authHeader())
      .send({ message: 'What is the current price?' });

    expect(res.status).toBe(503);

    if (original) process.env.OPENAI_API_KEY = original;
  });
});
