const express = require('express');
const { EnergyListing, Trade } = require('../models');
const { calculatePrice, BASE_PRICE_PER_KWH } = require('../services/pricingEngine');

const router = express.Router();

// Retail grid tariff we benchmark P2P prices against. Static for now —
// in production this would come from the utility's published tariff.
const GRID_PRICE_PER_KWH = 0.15;
// What the grid pays a prosumer for exported surplus (feed-in tariff).
const GRID_BUYBACK_PER_KWH = 0.05;

/**
 * Market snapshot used by the dashboards and marketplace header:
 * current fair P2P price, the grid tariff it's competing with, and
 * live supply/demand figures.
 */
router.get('/current', async (req, res, next) => {
  try {
    const [supplyAgg, matchedAgg] = await Promise.all([
      EnergyListing.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$quantityKWh' }, count: { $sum: 1 } } },
      ]),
      Trade.aggregate([
        { $match: { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
        { $group: { _id: null, total: { $sum: '$quantityKWh' } } },
      ]),
    ]);

    const totalSupplyKWh = supplyAgg[0]?.total || 0;
    const activeListings = supplyAgg[0]?.count || 0;
    const matchedTodayKWh = matchedAgg[0]?.total || 0;

    const fairPrice = calculatePrice({
      availableSupplyKwh: totalSupplyKWh,
      demandKwh: matchedTodayKWh,
    });

    res.json({
      fairPrice,
      basePrice: BASE_PRICE_PER_KWH,
      gridPrice: GRID_PRICE_PER_KWH,
      gridBuybackPrice: GRID_BUYBACK_PER_KWH,
      totalSupplyKWh: Number(totalSupplyKWh.toFixed(2)),
      matchedTodayKWh: Number(matchedTodayKWh.toFixed(2)),
      activeListings,
      updatedAt: new Date(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/listings', async (req, res, next) => {
  try {
    const listings = await EnergyListing.find({ status: 'active' }).populate(
      'prosumerId',
      'firstName lastName'
    );
    res.json(listings);
  } catch (err) {
    next(err);
  }
});

router.get('/quote', async (req, res, next) => {
  try {
    const availableSupplyKwh = await EnergyListing.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$quantityKWh' } } },
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
