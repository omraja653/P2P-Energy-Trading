const express = require('express');
const mongoose = require('mongoose');
const { User, SystemSettings, Announcement } = require('../../models');
const { getProvider } = require('../../config/blockchain');
const { isEmailConfigured, sendTicketNotification } = require('../../services/emailService');
const { isSmsConfigured } = require('../../services/smsService');
const adminLogService = require('../../services/adminLogService');

const router = express.Router();

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// Real checks only — each one either succeeds/fails against the actual
// dependency, or (email/SMS) reports whether credentials are configured at
// all, rather than a fabricated uptime number.
router.get('/system/health', async (req, res, next) => {
  try {
    const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    let blockchain = 'not configured';
    if (process.env.ENERGY_TRADE_CONTRACT_ADDRESS) {
      try {
        await withTimeout(getProvider().getBlockNumber(), 5000);
        blockchain = 'connected';
      } catch (err) {
        blockchain = 'unreachable';
      }
    }

    res.json({
      api: 'online',
      database,
      blockchain,
      email: isEmailConfigured() ? 'configured' : 'not configured (dev fallback active)',
      sms: isSmsConfigured() ? 'configured' : 'not configured (dev fallback active)',
      checkedAt: new Date(),
    });
  } catch (err) {
    next(err);
  }
});

// Emails every ACTIVE user directly — there's no in-app notification center
// to post this into instead. Best-effort per recipient; one failed send
// doesn't stop the rest.
router.post('/system/broadcast', async (req, res, next) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'subject and message are required' });

    const recipients = await User.find({ status: 'ACTIVE' }, 'email');
    await Promise.allSettled(
      recipients.map((u) =>
        sendTicketNotification({ toEmail: u.email, subject, heading: subject, body: message })
      )
    );

    const announcement = await Announcement.create({
      subject,
      message,
      sentBy: req.user.id,
      recipientCount: recipients.length,
    });

    await adminLogService.logAction(req.user.id, 'system.broadcast', 'system', null, `"${subject}" sent to ${recipients.length} users`);
    res.status(201).json(announcement);
  } catch (err) {
    next(err);
  }
});

router.get('/system/broadcasts', async (req, res, next) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(20).populate('sentBy', 'firstName lastName');
    res.json(announcements);
  } catch (err) {
    next(err);
  }
});

router.get('/system/settings', async (req, res, next) => {
  try {
    res.json(await SystemSettings.getSingleton());
  } catch (err) {
    next(err);
  }
});

const EDITABLE_SETTINGS = [
  'tradingHoursEnabled',
  'tradingHoursStart',
  'tradingHoursEnd',
  'platformFeeRate',
  'gridWheelRate',
  'minTradeKWh',
  'maxTradeKWh',
  'settlementConfirmationHours',
];

router.patch('/system/settings', async (req, res, next) => {
  try {
    const settings = await SystemSettings.getSingleton();
    for (const field of EDITABLE_SETTINGS) {
      if (req.body[field] !== undefined) settings[field] = req.body[field];
    }
    await settings.save();
    await adminLogService.logAction(req.user.id, 'system.settings', 'system', null, 'Platform settings updated');
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
