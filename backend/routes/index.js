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

module.exports = router;
