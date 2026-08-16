const express = require('express');
const { Trade, EnergyListing } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requireFields } = require('../middleware/validation');
const { matchListings } = require('../services/matchingEngine');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const trades = await Trade.find({
      $or: [{ buyerId: req.user.id }, { sellerId: req.user.id }],
    }).sort({ createdAt: -1 });
    res.json(trades);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireAuth,
  requireFields(['quantityKWh', 'tradingType']),
  async (req, res, next) => {
    try {
      const { quantityKWh, tradingType } = req.body;
      const listings = await EnergyListing.find({ status: 'active', tradingType });
      const { matches, unmatchedKwh } = matchListings(listings, quantityKWh);

      const trades = await Promise.all(
        matches.map(({ listing, amount }) =>
          Trade.create({
            listingId: listing._id,
            buyerId: req.user.id,
            sellerId: listing.prosumerId,
            quantityKWh: amount,
            pricePerKwh: listing.pricePerKwh,
            totalAmount: Number((amount * listing.pricePerKwh).toFixed(4)),
            tradingType,
            status: 'matched',
          })
        )
      );

      await EnergyListing.updateMany(
        { _id: { $in: matches.map(({ listing }) => listing._id) } },
        { $set: { status: 'matched' } }
      );

      res.status(201).json({ trades, unmatchedKwh });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
