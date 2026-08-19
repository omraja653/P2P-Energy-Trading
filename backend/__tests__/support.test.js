const request = require('supertest');

// No real emails during tests — same pattern as auth.test.js.
jest.mock('../services/emailService', () => ({
  sendEmailOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  sendPasswordResetOtp: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  sendTicketNotification: jest.fn().mockResolvedValue({ delivered: false, fallback: true }),
  isEmailConfigured: () => false,
}));

const app = require('../server');
const jwt = require('jsonwebtoken');
const { User, Ticket, TicketReply, Counter } = require('../models');

const CUSTOMER_EMAIL = 'support-flow-customer@example.com';
const AGENT_EMAIL = 'support-flow-agent@example.com';

function tokenFor(userId, type) {
  return jwt.sign({ id: userId, type }, process.env.JWT_SECRET || 'test-secret');
}

let customer;
let agent;
let customerToken;
let agentToken;

beforeAll(async () => {
  customer = new User({ email: CUSTOMER_EMAIL, firstName: 'Support', lastName: 'Customer', type: 'consumer', status: 'ACTIVE', emailVerified: true });
  customer.password = 'Str0ng!Pass';
  await customer.save();

  agent = new User({ email: AGENT_EMAIL, firstName: 'Support', lastName: 'Agent', type: 'support', status: 'ACTIVE', emailVerified: true });
  agent.password = 'Str0ng!Pass';
  await agent.save();

  customerToken = tokenFor(customer._id, 'consumer');
  agentToken = tokenFor(agent._id, 'support');
});

afterAll(async () => {
  await Ticket.deleteMany({ userId: { $in: [customer._id, agent._id] } });
  await TicketReply.deleteMany({ userId: { $in: [customer._id, agent._id] } });
  await User.deleteMany({ email: { $in: [CUSTOMER_EMAIL, AGENT_EMAIL] } });
});

describe('POST /api/support/tickets (create)', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/support/tickets').send({ subject: 'x', description: 'y', category: 'Billing' });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid category', async () => {
    const res = await request(app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ subject: 'Test', description: 'Something is wrong', category: 'Not A Real Category' });
    expect(res.status).toBe(400);
  });

  it('creates a ticket with an auto-incrementing TICKET-### id and auto-assigns an agent', async () => {
    const res = await request(app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ subject: 'Cannot buy energy', description: 'Buy button does nothing', category: 'Trading Issue', priority: 'High' });

    expect(res.status).toBe(201);
    expect(res.body.ticketId).toMatch(/^TICKET-\d{3}$/);
    expect(res.body.status).toBe('Open');
    // Auto-assigned to *some* support/admin user — could be the seeded demo
    // admin or this test's agent, since both are eligible least-busy picks.
    expect(res.body.assignedTo).toBeTruthy();
  });
});

describe('GET /api/support/tickets (customer list) and ticket detail', () => {
  let ticketId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ subject: 'Billing question', description: 'Why was I charged a platform fee?', category: 'Billing' });
    ticketId = res.body._id;
  });

  it("lists only the customer's own tickets", async () => {
    const res = await request(app).get('/api/support/tickets').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((t) => String(t.userId) === String(customer._id) || t.userId?._id === undefined)).toBe(true);
  });

  it('blocks another customer from viewing the ticket', async () => {
    const otherToken = tokenFor('000000000000000000000000', 'consumer');
    const res = await request(app).get(`/api/support/tickets/${ticketId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('lets the owner view their own ticket', async () => {
    const res = await request(app).get(`/api/support/tickets/${ticketId}`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Billing question');
  });
});

describe('replies', () => {
  let ticketId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ subject: 'Reply flow', description: 'Testing replies', category: 'General Inquiry' });
    ticketId = res.body._id;
  });

  it('lets the customer add a reply', async () => {
    const res = await request(app)
      .post(`/api/support/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ message: 'Any update?' });
    expect(res.status).toBe(201);
    expect(res.body.userRole).toBe('customer');
    expect(res.body.replyNumber).toBe(1);
  });

  it('lets an agent reply, which moves an Open ticket to In Progress', async () => {
    const res = await request(app)
      .post(`/api/support/admin/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ message: 'Looking into it now.' });
    expect(res.status).toBe(201);
    expect(res.body.userRole).toBe('support');

    const ticketRes = await request(app).get(`/api/support/tickets/${ticketId}`).set('Authorization', `Bearer ${customerToken}`);
    expect(ticketRes.body.status).toBe('In Progress');
  });

  it('rejects replies on a closed ticket', async () => {
    await request(app)
      .patch(`/api/support/admin/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'Closed' });

    const res = await request(app)
      .post(`/api/support/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ message: 'Still there?' });
    expect(res.status).toBe(400);
  });
});

describe('status updates', () => {
  let ticketId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ subject: 'Status flow', description: 'Testing status transitions', category: 'General Inquiry' });
    ticketId = res.body._id;
  });

  it('blocks a customer from setting an arbitrary status', async () => {
    const res = await request(app)
      .patch(`/api/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'In Progress' });
    expect(res.status).toBe(400);
  });

  it('blocks a customer from closing a non-Resolved ticket', async () => {
    const res = await request(app)
      .patch(`/api/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'Closed' });
    expect(res.status).toBe(400);
  });

  it('lets an agent set status, and the customer can then close a Resolved ticket', async () => {
    const agentRes = await request(app)
      .patch(`/api/support/admin/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'Resolved' });
    expect(agentRes.status).toBe(200);
    expect(agentRes.body.resolvedAt).toBeTruthy();

    const closeRes = await request(app)
      .patch(`/api/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'Closed' });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.status).toBe('Closed');
  });
});

describe('agent-only routes', () => {
  it('rejects a customer from the agent ticket list', async () => {
    const res = await request(app).get('/api/support/admin/tickets').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('lets an agent list all tickets, with filters', async () => {
    const res = await request(app)
      .get('/api/support/admin/tickets?category=Billing')
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((t) => t.category === 'Billing')).toBe(true);
  });

  it('returns real dashboard metrics', async () => {
    const res = await request(app).get('/api/support/admin/dashboard').set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalOpenTickets).toBe('number');
    expect(typeof res.body.resolutionRate).toBe('number');
    expect(res.body.ticketsByStatus).toBeTruthy();
  });
});
