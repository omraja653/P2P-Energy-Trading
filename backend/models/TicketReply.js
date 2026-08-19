const mongoose = require('mongoose');

const ticketReplySchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    // Sequential *within a ticket* (reply #1, #2, ...) rather than a global
    // counter — more useful for a UI thread, and simple countDocuments+1 is
    // fine here (replies aren't high-concurrency enough to need the atomic
    // Counter pattern Ticket's ticketNumber uses).
    replyNumber: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, enum: ['customer', 'support'], required: true },
    message: { type: String, required: true, trim: true },
    attachments: [{ type: String, trim: true }], // file URLs — no upload storage wired up yet, so this stays an empty array in practice
  },
  { timestamps: true }
);

ticketReplySchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model('TicketReply', ticketReplySchema);
