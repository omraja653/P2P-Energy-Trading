const { Ticket, TicketReply, User } = require('../models');
const { sendTicketNotification } = require('./emailService');

const POPULATE_USER = 'firstName lastName email type';

async function createTicket(userId, { subject, description, category, priority, chatbotInitiated, relatedChatMessage }) {
  const ticket = await Ticket.create({
    userId,
    subject,
    description,
    category,
    priority: priority || 'Medium',
    chatbotInitiated: Boolean(chatbotInitiated),
    relatedChatMessage: relatedChatMessage || null,
  });

  // Auto-assign to the support agent with the fewest currently-open tickets
  // (per spec: "Auto-assign new tickets to least busy agent" / "Auto-assign
  // to next available support agent" for chatbot-raised tickets). Best
  // effort — an unstaffed demo environment just leaves it unassigned.
  const agent = await pickLeastBusyAgent();
  if (agent) {
    ticket.assignedTo = agent._id;
    await ticket.save();
  }

  const customer = await User.findById(userId);
  if (customer) {
    await sendTicketNotification({
      toEmail: customer.email,
      subject: `Ticket ${ticket.ticketId} received`,
      heading: `We've received your ticket: ${subject}`,
      body: `Your ticket ${ticket.ticketId} has been created and is now ${ticket.status}. We'll get back to you shortly.`,
    });
  }
  if (agent) {
    await sendTicketNotification({
      toEmail: agent.email,
      subject: `New ticket assigned: ${ticket.ticketId}`,
      heading: `A new ticket has been assigned to you`,
      body: `${ticket.ticketId} — "${subject}" (${priority || 'Medium'} priority, ${category}).`,
    });
  }

  return ticket;
}

async function getTicketsByUser(userId) {
  return Ticket.find({ userId }).sort({ createdAt: -1 }).populate('assignedTo', POPULATE_USER);
}

async function getTicketById(ticketId) {
  return Ticket.findById(ticketId).populate('userId', POPULATE_USER).populate('assignedTo', POPULATE_USER);
}

async function updateTicketStatus(ticketId, status) {
  const ticket = await Ticket.findById(ticketId).populate('userId', POPULATE_USER).populate('assignedTo', POPULATE_USER);
  if (!ticket) return null;

  ticket.status = status;
  if (status === 'Resolved' || status === 'Closed') {
    if (!ticket.resolvedAt) ticket.resolvedAt = new Date();
  } else {
    ticket.resolvedAt = null;
  }
  await ticket.save();

  const isResolved = status === 'Resolved';
  const notifyBody = isResolved
    ? `Your ticket ${ticket.ticketId} has been resolved. Reply if you still need help, or close it if you're all set.`
    : `Your ticket ${ticket.ticketId} status changed to "${status}".`;

  if (ticket.userId?.email) {
    await sendTicketNotification({
      toEmail: ticket.userId.email,
      subject: `Ticket ${ticket.ticketId} ${isResolved ? 'resolved' : 'updated'}`,
      heading: isResolved ? 'Your ticket has been resolved' : 'Your ticket was updated',
      body: notifyBody,
    });
  }
  if (ticket.assignedTo?.email) {
    await sendTicketNotification({
      toEmail: ticket.assignedTo.email,
      subject: `Ticket ${ticket.ticketId} updated`,
      heading: 'Ticket status changed',
      body: `${ticket.ticketId} is now "${status}".`,
    });
  }

  return ticket;
}

async function assignTicket(ticketId, agentId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return null;

  ticket.assignedTo = agentId;
  await ticket.save();

  const agent = await User.findById(agentId);
  if (agent?.email) {
    await sendTicketNotification({
      toEmail: agent.email,
      subject: `Ticket assigned: ${ticket.ticketId}`,
      heading: 'A ticket has been assigned to you',
      body: `${ticket.ticketId} — "${ticket.subject}".`,
    });
  }

  return Ticket.findById(ticketId).populate('userId', POPULATE_USER).populate('assignedTo', POPULATE_USER);
}

async function addTicketReply(ticketId, userId, userRole, message) {
  const replyNumber = (await TicketReply.countDocuments({ ticketId })) + 1;
  const reply = await TicketReply.create({ ticketId, userId, userRole, message, replyNumber });

  const ticket = await Ticket.findById(ticketId).populate('userId', POPULATE_USER).populate('assignedTo', POPULATE_USER);
  if (ticket) {
    // A support reply on an Open ticket implicitly moves it to In Progress —
    // small quality-of-life touch so "Open" accurately means "nobody's
    // looked at this yet".
    if (userRole === 'support' && ticket.status === 'Open') {
      ticket.status = 'In Progress';
      await ticket.save();
    }

    const notifyTarget = userRole === 'support' ? ticket.userId : ticket.assignedTo;
    if (notifyTarget?.email) {
      await sendTicketNotification({
        toEmail: notifyTarget.email,
        subject: `New reply on ${ticket.ticketId}`,
        heading: `New reply on ticket ${ticket.ticketId}`,
        body: message.length > 200 ? `${message.slice(0, 200)}...` : message,
      });
    }
  }

  return reply.populate('userId', POPULATE_USER);
}

async function getTicketReplies(ticketId) {
  return TicketReply.find({ ticketId }).sort({ createdAt: 1 }).populate('userId', POPULATE_USER);
}

async function getAllTickets({ status, priority, assignedTo, category, search } = {}) {
  const query = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;
  if (category) query.category = category;

  let tickets = await Ticket.find(query)
    .sort({ createdAt: -1 })
    .populate('userId', POPULATE_USER)
    .populate('assignedTo', POPULATE_USER);

  // Search by ticket number or subject — done in-memory since ticketId is a
  // virtual (not a real indexed field to $regex against) and the dataset
  // size here doesn't warrant a text index.
  if (search) {
    const term = search.trim().toLowerCase();
    tickets = tickets.filter(
      (t) => t.ticketId.toLowerCase().includes(term) || t.subject.toLowerCase().includes(term)
    );
  }

  return tickets;
}

async function getTicketMetrics() {
  const [totalOpen, totalPending, totalInProgress, totalResolved, totalClosed, allTickets] = await Promise.all([
    Ticket.countDocuments({ status: 'Open' }),
    Ticket.countDocuments({ status: 'Pending' }),
    Ticket.countDocuments({ status: 'In Progress' }),
    Ticket.countDocuments({ status: 'Resolved' }),
    Ticket.countDocuments({ status: 'Closed' }),
    Ticket.find({}, 'status createdAt resolvedAt'),
  ]);

  // Avg response time: from ticket creation to first support reply.
  const firstSupportReplies = await TicketReply.aggregate([
    { $match: { userRole: 'support' } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$ticketId', firstReplyAt: { $first: '$createdAt' } } },
  ]);
  const ticketsById = new Map(allTickets.map((t) => [String(t._id), t]));
  const responseTimesMs = firstSupportReplies
    .map((r) => {
      const ticket = ticketsById.get(String(r._id));
      return ticket ? new Date(r.firstReplyAt) - new Date(ticket.createdAt) : null;
    })
    .filter((ms) => ms != null && ms >= 0);
  const avgResponseTimeHours = responseTimesMs.length
    ? responseTimesMs.reduce((sum, ms) => sum + ms, 0) / responseTimesMs.length / (1000 * 60 * 60)
    : null;

  const resolvedOrClosed = allTickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed');
  const resolutionRate = allTickets.length ? resolvedOrClosed.length / allTickets.length : 0;

  const pendingReplies = totalOpen + totalPending; // tickets awaiting a support response

  return {
    totalOpenTickets: totalOpen,
    ticketsByStatus: {
      Open: totalOpen,
      Pending: totalPending,
      'In Progress': totalInProgress,
      Resolved: totalResolved,
      Closed: totalClosed,
    },
    avgResponseTimeHours: avgResponseTimeHours != null ? Number(avgResponseTimeHours.toFixed(1)) : null,
    resolutionRate: Number((resolutionRate * 100).toFixed(1)),
    pendingReplies,
    totalTickets: allTickets.length,
  };
}

/** Support/admin user with the fewest currently-unresolved assigned tickets. */
async function pickLeastBusyAgent() {
  const agents = await User.find({ type: { $in: ['support', 'admin'] } });
  if (agents.length === 0) return null;

  const loadCounts = await Ticket.aggregate([
    { $match: { assignedTo: { $ne: null }, status: { $nin: ['Resolved', 'Closed'] } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);
  const loadByAgent = new Map(loadCounts.map((row) => [String(row._id), row.count]));

  return agents.reduce((least, agent) => {
    const agentLoad = loadByAgent.get(String(agent._id)) || 0;
    const leastLoad = loadByAgent.get(String(least._id)) || 0;
    return agentLoad < leastLoad ? agent : least;
  }, agents[0]);
}

module.exports = {
  createTicket,
  getTicketsByUser,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  addTicketReply,
  getTicketReplies,
  getAllTickets,
  getTicketMetrics,
  pickLeastBusyAgent,
};
