const express = require('express');
const mongoose = require('mongoose');
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
      const { matches, unmatchedKwh: plannedUnmatchedKwh } = matchListings(listings, quantityKWh);

      // --- Same two race conditions as slotMatchingService.matchSlot(),
      // same fix (a real transaction), found in the same QA pass:
      //
      // 1. `matches` above is computed from a plain `find()` read — two
      //    concurrent buy requests could both plan to buy the same
      //    listing before either one's `EnergyListing.updateMany(...)`
      //    (which used to run AFTER Trade.create) actually claimed it,
      //    letting the same listing be sold twice over.
      // 2. The old balance check (`buyer.walletBalance < totalCost`) was a
      //    plain read-then-branch, not conditioned on the same write —
      //    the same double-spend shape confirmed live in matchSlot().
      //
      // Fixed by atomically claiming each planned listing inside the
      // transaction (skipping — not erroring on — any that lost the race,
      // folding its quantity back into unmatchedKwh) and gating the
      // buyer's debit on their real-time balance the same way.
      const session = await mongoose.startSession();
      let trades = [];
      let unmatchedKwh = plannedUnmatchedKwh;
      let insufficientFunds = false;
      try {
        await session.withTransaction(async () => {
          const claimed = [];
          for (const { listing, amount } of matches) {
            const claimedListing = await EnergyListing.findOneAndUpdate(
              { _id: listing._id, status: 'active' },
              { $set: { status: 'matched' } },
              { new: true, session }
            );
            if (!claimedListing) {
              // Someone else claimed this listing concurrently — treat
              // exactly like "wasn't available", same as the matcher's
              // own unmatchedKwh accounting for a listing that ran out.
              unmatchedKwh += amount;
              continue;
            }
            claimed.push({ listing: claimedListing, amount });
          }

          const totalCost = claimed.reduce((sum, { listing, amount }) => sum + amount * listing.pricePerKwh, 0);

          if (totalCost > 0) {
            const buyerAfter = await User.findOneAndUpdate(
              { _id: req.user.id, walletBalance: { $gte: totalCost } },
              { $inc: { walletBalance: -totalCost } },
              { new: true, session }
            ).select('walletBalance');
            if (!buyerAfter) {
              insufficientFunds = true;
              throw new Error('__insufficient_funds__');
            }
          }

          for (const { listing, amount } of claimed) {
            const [trade] = await Trade.create(
              [
                {
                  listingId: listing._id,
                  buyerId: req.user.id,
                  sellerId: listing.prosumerId,
                  quantityKWh: amount,
                  pricePerKwh: listing.pricePerKwh,
                  totalAmount: Number((amount * listing.pricePerKwh).toFixed(4)),
                  tradingType,
                  status: 'matched',
                },
              ],
              { session }
            );
            await User.findByIdAndUpdate(listing.prosumerId, { $inc: { walletBalance: trade.totalAmount } }, { session });
            trades.push(trade);
          }
        });
      } catch (err) {
        if (err.message !== '__insufficient_funds__') throw err;
      } finally {
        session.endSession();
      }

      if (insufficientFunds) {
        const buyer = await User.findById(req.user.id).select('walletBalance');
        const totalCost = matches.reduce((sum, { listing, amount }) => sum + amount * listing.pricePerKwh, 0);
        return res.status(400).json({
          error: `Insufficient balance. Need ₹${totalCost.toFixed(2)}, have ₹${(buyer?.walletBalance ?? 0).toFixed(2)}.`,
        });
      }

      // The buyer (requester) already has the trade in this response — the
      // seller finds out their listing sold asynchronously, so they're the
      // one who needs a notification. Socket/email side effects stay
      // outside the transaction — they aren't part of the atomic financial
      // guarantee, and retrying a committed transaction would risk
      // duplicating them.
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

      if (trades.length) {
        const buyerAfter = await User.findById(req.user.id).select('walletBalance');
        const totalDebited = trades.reduce((sum, t) => sum + t.totalAmount, 0);
        socketService.emitWalletUpdated(req.user.id, {
          walletBalance: buyerAfter.walletBalance,
          transaction: { type: 'purchase', amount: totalDebited },
        });
      }
      for (const trade of trades) {
        const sellerAfter = await User.findById(trade.sellerId).select('walletBalance');
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
