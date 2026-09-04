const express = require('express');
const { Trade, EnergyListing, User } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requireTradingVerification } = require('../middleware/verification');
const { requireFields } = require('../middleware/validation');
const { matchListings } = require('../services/matchingEngine');
const { notifyMatch } = require('../services/notificationService');
const socketService = require('../services/socket');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const trades = await Trade.find({
      $or: [{ buyerId: req.user.id }, { sellerId: req.user.id }],
    })
      .sort({ createdAt: -1 })
      .populate('buyerId', 'firstName lastName')
      .populate('sellerId', 'firstName lastName');
    res.json(trades);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireAuth,
  requireTradingVerification,
  requireFields(['quantityKWh', 'tradingType']),
  async (req, res, next) => {
    try {
      const { quantityKWh, tradingType } = req.body;
      const listings = await EnergyListing.find({ status: 'active', tradingType });
      const { matches, unmatchedKwh } = matchListings(listings, quantityKWh);

      // Real wallet-balance gate — checked against the actual total this
      // request would cost (computed from the real matches, not trusted
      // from the client), before any Trade is created. See
      // routes/slots.js for the same gate on the bid-placement path.
      const totalCost = matches.reduce((sum, { listing, amount }) => sum + amount * listing.pricePerKwh, 0);
      if (totalCost > 0) {
        const buyer = await User.findById(req.user.id).select('walletBalance');
        if ((buyer?.walletBalance ?? 0) < totalCost) {
          return res.status(400).json({
            error: `Insufficient balance. Need ₹${totalCost.toFixed(2)}, have ₹${(buyer?.walletBalance ?? 0).toFixed(2)}.`,
          });
        }
      }

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

      // The buyer (requester) already has the trade in this response — the
      // seller finds out their listing sold asynchronously, so they're the
      // one who needs a notification.
      await Promise.all(
        trades.map((trade) =>
          notifyMatch({
            userId: trade.sellerId,
            counterpartyId: req.user.id,
            tradeId: trade._id,
            quantityKWh: trade.quantityKWh,
            pricePerKwh: trade.pricePerKwh,
            totalAmount: trade.totalAmount,
            asBuyer: false,
          })
        )
      );

      // Real wallet debit/credit — walletBalance is the Razorpay top-up
      // ledger (see routes/wallet.js), separate from the existing
      // admin/blockchain Settlement flow (routes/settlements.js), which is
      // untouched by this. One debit for the buyer's combined total; one
      // credit per trade for that trade's own seller — $inc is atomic per
      // call, so a buyer matched against the same seller twice just
      // applies two correct increments, no aggregation needed.
      if (totalCost > 0) {
        const buyerAfter = await User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: -totalCost } }, { new: true }).select('walletBalance');
        socketService.emitWalletUpdated(req.user.id, {
          walletBalance: buyerAfter.walletBalance,
          transaction: { type: 'purchase', amount: totalCost },
        });
      }
      for (const trade of trades) {
        const sellerAfter = await User.findByIdAndUpdate(trade.sellerId, { $inc: { walletBalance: trade.totalAmount } }, { new: true }).select('walletBalance');
        socketService.emitWalletUpdated(trade.sellerId, {
          walletBalance: sellerAfter.walletBalance,
          transaction: { type: 'sale', amount: trade.totalAmount },
        });
      }

      // Same real 'matched' Trade status as the slot-matching path — Orders
      // page gets live updates from this instant-match flow too, not just
      // the /bid order book.
      for (const trade of trades) {
        socketService.emitOrderStatusChanged([String(trade.sellerId), String(trade.buyerId)], {
          orderId: String(trade._id),
          newStatus: trade.status,
          quantityKWh: trade.quantityKWh,
          pricePerKwh: trade.pricePerKwh,
          totalAmount: trade.totalAmount,
          blockchainHash: trade.blockchainTxHash || null,
        });
      }

      res.status(201).json({ trades, unmatchedKwh });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
