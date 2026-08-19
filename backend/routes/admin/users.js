const express = require('express');
const adminUserService = require('../../services/adminUserService');
const adminLogService = require('../../services/adminLogService');

const router = express.Router();

const SETTABLE_STATUSES = ['ACTIVE', 'SUSPENDED', 'BLOCKED'];

router.get('/', async (req, res, next) => {
  try {
    const { role, status, emailVerified, mobileVerified, kycVerified, search } = req.query;
    const users = await adminUserService.getUsers({ role, status, emailVerified, mobileVerified, kycVerified, search });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const detail = await adminUserService.getUserDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'User not found' });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!SETTABLE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${SETTABLE_STATUSES.join(', ')}` });
    }
    const user = await adminUserService.setStatus(req.params.id, status);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await adminLogService.logAction(req.user.id, `user.status.${status.toLowerCase()}`, 'user', user._id, `Status set to ${status}`);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/verify-email', async (req, res, next) => {
  try {
    const user = await adminUserService.verifyEmail(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await adminLogService.logAction(req.user.id, 'user.verify-email', 'user', user._id, 'Email manually verified by admin');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/verify-mobile', async (req, res, next) => {
  try {
    const user = await adminUserService.verifyMobile(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await adminLogService.logAction(req.user.id, 'user.verify-mobile', 'user', user._id, 'Mobile manually verified by admin');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send-otp', async (req, res, next) => {
  try {
    const { channel } = req.body;
    const result = await adminUserService.resendOtp(req.params.id, channel);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    await adminLogService.logAction(req.user.id, 'user.resend-otp', 'user', req.params.id, `Resent ${channel} OTP`);
    res.json({ message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await adminUserService.deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    await adminLogService.logAction(req.user.id, 'user.delete', 'user', req.params.id, 'Account deleted by admin');
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
