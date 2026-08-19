const mongoose = require('mongoose');

// A record of system-wide broadcasts sent from Admin → System Health. There
// is no in-app notification center to display these in yet — sending one
// emails every active user directly (via the existing Brevo integration)
// and keeps a record here for the audit trail / "recent broadcasts" list.
const announcementSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
