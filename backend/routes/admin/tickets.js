const express = require('express');
const { Ticket } = require('../../models');
const ticketService = require('../../services/ticketService');
const adminLogService = require('../../services/adminLogService');

const router = express.Router();
const { PRIORITIES, STATUSES } = Ticket;

// Thin wrapper over the same ticketService the support-agent routes use
// (see routes/support.js's agentRouter) — avoids reimplementing ticket
// business logic a second time for the admin surface. Adds an audit-log
// entry on every mutation, since this is the admin-facing route.

router.get('/', async (req, res, next) => {
  try {
    const { status, priority, assignedTo, category, search } = req.query;
    const tickets = await ticketService.getAllTickets({ status, priority, assignedTo, category, search });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const replies = await ticketService.getTicketReplies(req.params.id);
    res.json({ ...ticket.toObject(), replies });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    const ticket = await ticketService.updateTicketStatus(req.params.id, status);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    await adminLogService.logAction(req.user.id, 'ticket.status', 'ticket', ticket._id, `Set to ${status}`);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/priority', async (req, res, next) => {
  try {
    const { priority } = req.body;
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(', ')}` });
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { priority }, { new: true });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    await adminLogService.logAction(req.user.id, 'ticket.priority', 'ticket', ticket._id, `Set to ${priority}`);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/assign', async (req, res, next) => {
  try {
    const agentId = req.body.agentId || req.user.id;
    const ticket = await ticketService.assignTicket(req.params.id, agentId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    await adminLogService.logAction(req.user.id, 'ticket.assign', 'ticket', ticket._id, `Assigned to ${agentId}`);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reply', async (req, res, next) => {
  try {
    if (!req.body.message) return res.status(400).json({ error: 'message is required' });
    const reply = await ticketService.addTicketReply(req.params.id, req.user.id, 'support', req.body.message);
    res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/close', async (req, res, next) => {
  try {
    const ticket = await ticketService.updateTicketStatus(req.params.id, 'Closed');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    await adminLogService.logAction(req.user.id, 'ticket.close', 'ticket', ticket._id, req.body.decision || 'Closed by admin');
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
