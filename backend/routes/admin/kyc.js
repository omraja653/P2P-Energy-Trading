const express = require('express');
const adminKycService = require('../../services/adminKycService');
const adminLogService = require('../../services/adminLogService');

const router = express.Router();

// See services/adminKycService.js for why this is a review queue over the
// kycVerified boolean rather than a document-review workflow — there's no
// document upload system in this project.
router.get('/', async (req, res, next) => {
  try {
    const users = await adminKycService.getQueue({ status: req.query.status });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await adminKycService.getDetail(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/approve', async (req, res, next) => {
  try {
    const user = await adminKycService.approve(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await adminLogService.logAction(req.user.id, 'kyc.approve', 'user', user._id, req.body.notes || 'KYC approved');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/reject', async (req, res, next) => {
  try {
    if (!req.body.reason) return res.status(400).json({ error: 'reason is required to reject KYC' });
    const user = await adminKycService.reject(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await adminLogService.logAction(req.user.id, 'kyc.reject', 'user', user._id, req.body.reason);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// No document-submission flow exists for a user to actually act on this —
// this just logs the request and (best-effort) emails the user a note.
// Kept because the spec asks for it explicitly; honestly limited.
router.post('/:id/request-resubmit', async (req, res, next) => {
  try {
    const user = await adminKycService.getDetail(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { sendTicketNotification } = require('../../services/emailService');
    await sendTicketNotification({
      toEmail: user.email,
      subject: 'Please resubmit your verification details',
      heading: 'Additional KYC information needed',
      body: req.body.message || 'An admin has requested you resubmit your identity verification details.',
    });

    await adminLogService.logAction(req.user.id, 'kyc.request-resubmit', 'user', user._id, req.body.message || 'Resubmission requested');
    res.json({ message: 'Resubmission request sent' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
