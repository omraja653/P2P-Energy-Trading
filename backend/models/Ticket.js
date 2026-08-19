const mongoose = require('mongoose');
const { getNextSequence } = require('./Counter');

const CATEGORIES = ['Bug Report', 'Billing', 'General Inquiry', 'Feature Request', 'Trading Issue'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Open', 'Pending', 'In Progress', 'Resolved', 'Closed'];

const ticketSchema = new mongoose.Schema(
  {
    // Numeric sequence from the shared Counter, formatted as "TICKET-001"
    // via the virtual below — stored as a number so it sorts/queries
    // cleanly, formatted only for display.
    ticketNumber: { type: Number, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    status: { type: String, enum: STATUSES, default: 'Open' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    // True if this ticket was raised via the chatbot's "raise a ticket"
    // hand-off rather than the Support Center form directly.
    chatbotInitiated: { type: Boolean, default: false },
    // Free-text snapshot of the chat context at hand-off time (e.g. the
    // user's last question) — not a live link to chat history, just enough
    // context for the agent to see what the bot couldn't resolve.
    relatedChatMessage: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ticketSchema.virtual('ticketId').get(function ticketId() {
  return `TICKET-${String(this.ticketNumber).padStart(3, '0')}`;
});

ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ userId: 1 });

ticketSchema.pre('validate', async function assignTicketNumber(next) {
  if (this.isNew && this.ticketNumber == null) {
    this.ticketNumber = await getNextSequence('ticketNumber');
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.PRIORITIES = PRIORITIES;
module.exports.STATUSES = STATUSES;
