const express = require('express');
const { Trade, EnergyListing } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requireFields } = require('../middleware/validation');
const { matchListings } = require('../services/matchingEngine');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const trades = await Trade.find({
      $or: [{ buyer: req.user.id }, { seller: req.user.id }],
    }).sort({ createdAt: -1 });
    res.json(trades);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireFields(['energyAmountKwh']), async (req, res, next) => {
  try {
    const { energyAmountKwh } = req.body;
    const listings = await EnergyListing.find({ status: 'available' });
    const { matches, unmatchedKwh } = matchListings(listings, energyAmountKwh);

    const trades = await Promise.all(
      matches.map(({ listing, amount }) =>
        Trade.create({
          listing: listing._id,
          buyer: req.user.id,
          seller: listing.seller,
          energyAmountKwh: amount,
          pricePerKwh: listing.pricePerKwh,
          totalPrice: Number((amount * listing.pricePerKwh).toFixed(4)),
          status: 'matched',
        })
      )
    );

    res.status(201).json({ trades, unmatchedKwh });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
