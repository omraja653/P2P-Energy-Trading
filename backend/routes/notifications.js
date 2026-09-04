const express = require('express');
const { requireAuth } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

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
