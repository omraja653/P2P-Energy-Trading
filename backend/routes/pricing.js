const express = require('express');
const { EnergyListing } = require('../models');
const { calculatePrice } = require('../services/pricingEngine');

const router = express.Router();

router.get('/listings', async (req, res, next) => {
  try {
    const listings = await EnergyListing.find({ status: 'available' }).populate('seller', 'name');
    res.json(listings);
  } catch (err) {
    next(err);
  }
});

router.get('/quote', async (req, res, next) => {
  try {
    const availableSupplyKwh = await EnergyListing.aggregate([
      { $match: { status: 'available' } },
      { $group: { _id: null, total: { $sum: '$energyAmountKwh' } } },
    ]);

    const price = calculatePrice({
      availableSupplyKwh: availableSupplyKwh[0]?.total || 0,
      demandKwh: Number(req.query.demandKwh) || 0,
    });

    res.json({ pricePerKwh: price });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
