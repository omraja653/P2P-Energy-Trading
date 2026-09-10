const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { User } = require('../models');

const router = express.Router();

// One-click unsubscribe from the daily trading-reminder email. Public (no
// session) — the JWT in `token` is the proof, carried in the email link
// (jobs/morningEmailJob.js). Purpose-scoped so a leaked link can only ever
// toggle this one preference, nothing else. Renders a tiny HTML page rather
// than JSON since it's opened directly in a browser from an email client.
router.get('/email/unsubscribe', async (req, res) => {
  const page = (msg) =>
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<div style="font-family:Arial,sans-serif;max-width:420px;margin:64px auto;text-align:center;color:#1e293b">` +
    `<h2>⚡ GridMate</h2><p>${msg}</p></div>`;
  try {
    const payload = jwt.verify(String(req.query.token || ''), process.env.JWT_SECRET);
    if (payload.purpose !== 'email-unsub' || !payload.uid) {
      return res.status(400).send(page('This unsubscribe link is not valid.'));
    }
    await User.findByIdAndUpdate(payload.uid, { dailyEmailOptOut: true });
    res.send(page("You've been unsubscribed from daily trading reminders. You'll still get account emails like verification codes."));
  } catch (err) {
    res.status(400).send(page('This unsubscribe link is invalid or has expired.'));
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await notificationService.getNotifications(req.user.id, {
      unseenOnly: req.query.unseen === 'true',
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/seen', requireAuth, async (req, res, next) => {
  try {
    const notification = await notificationService.markSeen(req.params.id, req.user.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
