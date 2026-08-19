const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireFields } = require('../middleware/validation');
const profileService = require('../services/profileService');
const { User } = require('../models');

const router = express.Router();

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const MOBILE_REGEX = /^\+[1-9]\d{7,14}$/;
const BIO_MAX_LENGTH = 200;

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.patch('/', requireAuth, async (req, res, next) => {
  try {
    const { firstName, lastName, bio, address, profilePicture } = req.body;

    if (bio !== undefined && bio.length > BIO_MAX_LENGTH) {
      return res.status(400).json({ error: `bio must be ${BIO_MAX_LENGTH} characters or fewer` });
    }
    if (firstName !== undefined && !firstName.trim()) {
      return res.status(400).json({ error: 'firstName cannot be empty' });
    }
    if (lastName !== undefined && !lastName.trim()) {
      return res.status(400).json({ error: 'lastName cannot be empty' });
    }

    const updated = await profileService.updateProfile(req.user.id, { firstName, lastName, bio, address, profilePicture });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/password',
  requireAuth,
  requireFields(['oldPassword', 'newPassword']),
  async (req, res, next) => {
    try {
      const { oldPassword, newPassword } = req.body;

      if (!PASSWORD_REGEX.test(newPassword)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character',
        });
      }

      const result = await profileService.changePassword(req.user.id, oldPassword, newPassword);
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      res.json({ message: 'Password changed' });
    } catch (err) {
      next(err);
    }
  }
);

// Starts an OTP-gated mobile number change — the number only takes effect
// once the code is confirmed via the existing POST /auth/verify-mobile-otp
// (registrationId in the response here is just this user's own id).
router.patch(
  '/mobile',
  requireAuth,
  requireFields(['mobileNumber']),
  async (req, res, next) => {
    try {
      const { mobileNumber } = req.body;
      if (!MOBILE_REGEX.test(mobileNumber)) {
        return res.status(400).json({ error: 'mobileNumber must be a valid phone number, e.g. +14155552671' });
      }

      const result = await profileService.updateMobile(req.user.id, mobileNumber);
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      res.json({ message: 'OTP sent', registrationId: result.registrationId });
    } catch (err) {
      next(err);
    }
  }
);

// Not in the original spec's route list, but the frontend's "Delete
// Account" button needs somewhere to go. Requires the current password as
// confirmation (Google accounts skip that check — they have none). This is
// a hard delete of the User document only — trades/tickets/settlements
// that reference this user id are left as-is (existing UI already falls
// back to "Unknown" for a populated user reference it can't resolve, same
// as any other missing/foreign account), not cascaded or anonymized.
router.delete('/', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.passwordHash) {
      if (!req.body.password) {
        return res.status(400).json({ error: 'password is required to confirm account deletion' });
      }
      if (!(await user.comparePassword(req.body.password))) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/tickets', requireAuth, async (req, res, next) => {
  try {
    const tickets = await profileService.getRecentTickets(req.user.id, 5);
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

router.get('/activity', requireAuth, async (req, res, next) => {
  try {
    const activity = await profileService.getRecentActivity(req.user.id, 10);
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
