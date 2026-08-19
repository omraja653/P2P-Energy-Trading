const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth');

const users = require('./users');
const kyc = require('./kyc');
const trades = require('./trades');
const settlements = require('./settlements');
const tickets = require('./tickets');
const metrics = require('./metrics');
const reports = require('./reports');
const system = require('./system');

const router = express.Router();

// Every /api/admin/* route requires an authenticated admin — applied once
// here rather than per-file.
router.use(requireAuth, requireRole('admin'));

router.use('/users', users);
router.use('/kyc', kyc);
router.use('/trades', trades);
router.use('/settlements', settlements);
router.use('/tickets', tickets);
router.use('/reports', reports);
// metrics.js and system.js each define routes at their own top-level paths
// (/dashboard, /analytics/*, /logs, /system/*) rather than being nested
// under a shared prefix, matching the spec's flat /api/admin/... paths.
router.use('/', metrics);
router.use('/', system);

module.exports = router;
