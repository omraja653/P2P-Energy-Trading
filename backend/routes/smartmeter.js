const express = require('express');
const { MeterData } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { generateReading, isSimulatorEnabled } = require('../services/smartMeterSimulator');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const readings = await MeterData.find({ user: req.user.id }).sort({ recordedAt: -1 }).limit(50);
    res.json(readings);
  } catch (err) {
    next(err);
  }
});

router.post('/simulate', requireAuth, async (req, res, next) => {
  try {
    if (!isSimulatorEnabled()) {
      return res.status(403).json({ error: 'Smart meter simulator is disabled' });
    }

    const reading = generateReading({ meterId: req.body.meterId || `meter-${req.user.id}` });
    const saved = await MeterData.create({ user: req.user.id, ...reading });
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
