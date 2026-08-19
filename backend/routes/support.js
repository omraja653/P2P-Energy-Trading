const express = require('express');
const { Ticket } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireFields } = require('../middleware/validation');
const ticketService = require('../services/ticketService');

const router = express.Router();

const { CATEGORIES, PRIORITIES, STATUSES } = Ticket;
// Support/admin can set a ticket to any of these; a customer may only move
// their own ticket from Resolved -> Closed (handled explicitly below).
const AGENT_SETTABLE_STATUSES = STATUSES;

function isOwner(ticket, userId) {
  const ownerId = ticket.userId?._id || ticket.userId;
  return String(ownerId) === String(userId);
}

function isAgent(user) {
  return user && ['support', 'admin'].includes(user.type);
}

// ---- Customer routes --------------------------------------------------------

router.post(
  '/tickets',
  requireAuth,
  requireFields(['subject', 'description', 'category']),
  async (req, res, next) => {
    try {
      const { subject, description, category, priority, chatbotInitiated, relatedChatMessage } = req.body;

      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
      }
      if (priority && !PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(', ')}` });
      }

      const ticket = await ticketService.createTicket(req.user.id, {
        subject,
        description,
        category,
        priority,
        chatbotInitiated,
        relatedChatMessage,
      });
      res.status(201).json(ticket);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/tickets', requireAuth, async (req, res, next) => {
  try {
    const tickets = await ticketService.getTicketsByUser(req.user.id);
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

router.get('/tickets/:id', requireAuth, async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isOwner(ticket, req.user.id) && !isAgent(req.user)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.get('/tickets/:id/replies', requireAuth, async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isOwner(ticket, req.user.id) && !isAgent(req.user)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const replies = await ticketService.getTicketReplies(req.params.id);
    res.json(replies);
  } catch (err) {
    next(err);
  }
});

// Customer-facing update — deliberately narrow: the only thing a customer
// can do here is close their own already-resolved ticket. Status/priority/
// assignment changes go through the agent routes below.
router.patch('/tickets/:id', requireAuth, requireFields(['status']), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (status !== 'Closed') {
      return res.status(400).json({ error: "Customers can only set status to 'Closed'" });
    }

    const ticket = await ticketService.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isOwner(ticket, req.user.id)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (ticket.status !== 'Resolved') {
      return res.status(400).json({ error: 'Only a Resolved ticket can be closed by its owner' });
    }

    const updated = await ticketService.updateTicketStatus(req.params.id, 'Closed');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/tickets/:id/reply',
  requireAuth,
  requireFields(['message']),
  async (req, res, next) => {
    try {
      const ticket = await ticketService.getTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (!isOwner(ticket, req.user.id)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      if (ticket.status === 'Closed') {
        return res.status(400).json({ error: 'This ticket is closed and no longer accepts replies' });
      }

      const reply = await ticketService.addTicketReply(req.params.id, req.user.id, 'customer', req.body.message);
      res.status(201).json(reply);
    } catch (err) {
      next(err);
    }
  }
);

// ---- Support/admin routes ----------------------------------------------------

const agentRouter = express.Router();
agentRouter.use(requireAuth, requireRole('support', 'admin'));

agentRouter.get('/tickets', async (req, res, next) => {
  try {
    const { status, priority, assignedTo, category, search } = req.query;
    const tickets = await ticketService.getAllTickets({ status, priority, assignedTo, category, search });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

agentRouter.patch('/tickets/:id/assign', async (req, res, next) => {
  try {
    // No agentId in the body means "assign to me" (the common "Assign to
    // Me" button case).
    const agentId = req.body.agentId || req.user.id;
    const ticket = await ticketService.assignTicket(req.params.id, agentId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

agentRouter.patch('/tickets/:id/status', requireFields(['status']), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!AGENT_SETTABLE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${AGENT_SETTABLE_STATUSES.join(', ')}` });
    }
    const ticket = await ticketService.updateTicketStatus(req.params.id, status);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

agentRouter.post('/tickets/:id/reply', requireFields(['message']), async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const reply = await ticketService.addTicketReply(req.params.id, req.user.id, 'support', req.body.message);
    res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
});

agentRouter.get('/dashboard', async (req, res, next) => {
  try {
    const metrics = await ticketService.getTicketMetrics();
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

router.use('/admin', agentRouter);

module.exports = router;
