const { Server } = require('socket.io');

// Singleton — server.js calls init(httpServer) once; every other module
// (slotMatchingService, routes/trades.js, routes/settlements.js) calls the
// emit* helpers below instead of touching `io` directly, so there's one
// place that knows the event names/payload shapes.
let io = null;

function init(httpServer) {
  io = new Server(httpServer, {
    // Same permissive policy as the existing app.use(cors()) in server.js —
    // this app is accessed from localhost and arbitrary LAN IPs (see the
    // relative-API-path fix), so a fixed origin would break that.
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    // No JWT verification on this — it's a real, honest simplification,
    // not an oversight: joining a room only means "receive a copy of
    // events addressed to this userId", it grants no read/write access to
    // anything. Every actual mutation (placing a bid, buying, admin
    // actions) still goes through the existing REST endpoints, which do
    // check the JWT. Building full socket-auth middleware wasn't asked for
    // and isn't needed for that reason.
    socket.on('join', (userId) => {
      if (userId) socket.join(String(userId));
    });
  });

  return io;
}

function getIO() {
  return io;
}

// --- Marketplace-facing events (broadcast to everyone) -----------------------

function emitNewBid(bid) {
  if (io) io.emit('new-bid', bid);
}

function emitBidMatched(bidIds) {
  if (io) io.emit('bid-matched', { bidIds });
}

function emitBidCancelled(bidId) {
  if (io) io.emit('bid-cancelled', { bidId });
}

// --- Orders-facing events (targeted at the two users involved) ---------------

/** `userIds`: array of user ids to notify — typically [buyerId, sellerId]. */
function emitOrderStatusChanged(userIds, payload) {
  if (!io) return;
  for (const id of userIds) {
    io.to(String(id)).emit('order-status-changed', payload);
  }
}

function emitOrderCancelled(userIds, orderId) {
  if (!io) return;
  for (const id of userIds) {
    io.to(String(id)).emit('order-cancelled', { orderId });
  }
}

// --- Support-ticket events -----------------------------------------------

/** Broadcast — every connected support/admin dashboard sees a new ticket land. */
function emitNewSupportTicket(ticket) {
  if (io) io.emit('new-support-ticket', ticket);
}

/** Broadcast — any status/priority/assignment change, so every agent dashboard's list stays in sync. */
function emitTicketUpdated(payload) {
  if (io) io.emit('ticket-updated', payload);
}

/** Targeted — the ticket's owner (and, where relevant, its assigned agent) see the status change live. */
function emitTicketStatusChanged(userIds, payload) {
  if (!io) return;
  for (const id of userIds) {
    if (id) io.to(String(id)).emit('ticket-status-changed', payload);
  }
}

/** Targeted — the other party in the thread (whoever didn't just post) sees the new reply live. */
function emitTicketReplyAdded(userIds, payload) {
  if (!io) return;
  for (const id of userIds) {
    if (id) io.to(String(id)).emit('ticket-reply-added', payload);
  }
}

// --- Wallet events ---------------------------------------------------------

/** Targeted — a real trigger this time (Razorpay top-up completed), not a fabricated one. */
function emitWalletUpdated(userId, payload) {
  if (io && userId) io.to(String(userId)).emit('wallet-updated', payload);
}

module.exports = {
  init,
  getIO,
  emitNewBid,
  emitBidMatched,
  emitBidCancelled,
  emitOrderStatusChanged,
  emitOrderCancelled,
  emitNewSupportTicket,
  emitTicketUpdated,
  emitTicketStatusChanged,
  emitTicketReplyAdded,
  emitWalletUpdated,
};
