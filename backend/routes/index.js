const express = require('express');
const auth = require('./auth');
const smartmeter = require('./smartmeter');
const pricing = require('./pricing');
const trades = require('./trades');
const settlements = require('./settlements');
const chat = require('./chat');
const admin = require('./admin');
const support = require('./support');
const profile = require('./profile');
const forecasting = require('./forecasting');
const slots = require('./slots');
const auction = require('./auction');
const revenue = require('./revenue');
const notifications = require('./notifications');
const dashboard = require('./dashboard');
const wallet = require('./wallet');

const router = express.Router();

router.use('/auth', auth);
router.use('/smartmeter', smartmeter);
router.use('/pricing', pricing);
router.use('/trades', trades);
router.use('/settlements', settlements);
router.use('/chat', chat);
router.use('/admin', admin);
router.use('/support', support);
router.use('/profile', profile);
router.use('/forecasting', forecasting);
// Trading mechanism: the periodic double auction (/auction) is the single
// path exposed in the UI. /slots (the instant bid/ask matcher) and the
// EnergyListing "Buy Now" flow under /trades + /pricing/listings are no
// longer reachable from the frontend, but stay mounted here — their
// integration tests (advanced.test.js, matching.test.js) still run against
// them, and re-linking a page is all it takes to reactivate either one.
router.use('/slots', slots);
router.use('/auction', auction);
router.use('/revenue', revenue);
router.use('/notifications', notifications);
router.use('/dashboard', dashboard);
router.use('/wallet', wallet);

module.exports = router;
