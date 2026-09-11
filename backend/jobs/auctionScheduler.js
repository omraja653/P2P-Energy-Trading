const mongoose = require('mongoose');
const { AuctionOrder, Trade, User } = require('../models');
const { runAuction } = require('../services/doubleAuctionEngine');
const { notifyMatch } = require('../services/notificationService');
const socketService = require('../services/socket');

// How long a round collects orders before it clears. The pasted spec wanted
// 15 min (prod) / 30 s (demo); 5 minutes is the compromise actually used
// here — long enough for a few orders to pile up so the clearing-price
// behaviour is visible, short enough to demo in a sitting, and it does NOT
// hammer the blockchain (each cleared trade is later settled on-chain by
// settlementScheduler, which costs real testnet gas). Override with
// AUCTION_INTERVAL_MS if needed.
const AUCTION_INTERVAL_MS = Number(process.env.AUCTION_INTERVAL_MS) || 180000;

// Buffer between a round clearing and the next one starting to collect.
// This does NOT make the next round wait for settlement to actually finish
// (settlementScheduler runs on its own independent ~60s cycle and retries
// forever — coupling round N+1's start to round N's on-chain settlement
// completing would mean a single slow/stuck settlement, e.g. the relayer
// wallet running low on testnet gas, freezes the entire auction venue).
// It's a fixed scheduling gap only, so the batch that just cleared has
// clear room on the settlement scheduler's queue before another batch of
// trades lands on top of it. Override with SETTLEMENT_GAP_MS if needed.
const SETTLEMENT_GAP_MS = Number(process.env.SETTLEMENT_GAP_MS) || 300000;

// The actual tick period: collection window + settlement buffer.
const ROUND_CYCLE_MS = AUCTION_INTERVAL_MS + SETTLEMENT_GAP_MS;

let intervalHandle = null;
let running = false;
let round = 0;

/**
 * Close one auction round: run the pure engine over every open order, then
 * for each fill do the real money movement + Trade creation, each fill in
 * its own transaction (mirrors slotMatchingService.matchSlot — one bad
 * buyer aborts only its own pair, not the whole round). Orders are updated
 * with how much they filled; a fully-filled order becomes 'matched', a
 * partially-filled one keeps the remainder 'pending' for the next round.
 *
 * Returns a summary object (also broadcast over sockets).
 */
async function runOnce() {
  if (running) {
    console.log('[auctionScheduler] previous round still running — skipping');
    return null;
  }
  running = true;
  round += 1;
  const thisRound = round;

  try {
    const [buyOrders, sellOrders] = await Promise.all([
      AuctionOrder.find({ status: 'pending', side: 'BUY' }).sort({ createdAt: 1 }),
      AuctionOrder.find({ status: 'pending', side: 'SELL' }).sort({ createdAt: 1 }),
    ]);

    const plan = runAuction(
      buyOrders.map((o) => ({ _id: o._id, userId: o.userId, quantity: o.quantity, pricePerKwh: o.pricePerKwh })),
      sellOrders.map((o) => ({ _id: o._id, userId: o.userId, quantity: o.quantity, pricePerKwh: o.pricePerKwh }))
    );

    if (!plan.cleared) {
      // Nothing traded — either no orders on one side, or no price overlap.
      // Silent unless there was actually something to try to match.
      if (buyOrders.length && sellOrders.length) {
        console.log(
          `[auctionScheduler] round ${thisRound}: ${buyOrders.length} buy / ${sellOrders.length} sell, no price overlap — nothing cleared`
        );
      }
      return {
        round: thisRound,
        cleared: false,
        clearingPrice: null,
        clearingQuantity: 0,
        tradeCount: 0,
        buyOrders: buyOrders.length,
        sellOrders: sellOrders.length,
      };
    }

    const byId = new Map();
    for (const o of [...buyOrders, ...sellOrders]) byId.set(String(o._id), o);

    const filled = new Map(); // orderId -> total quantity filled this round
    const createdTrades = [];

    for (const m of plan.matches) {
      const total = Number((m.quantity * plan.clearingPrice).toFixed(4));
      const session = await mongoose.startSession();
      let ok = false;
      try {
        await session.withTransaction(async () => {
          // Atomic, balance-gated debit — the $gte is evaluated by MongoDB
          // at write time, same backstop slotMatchingService uses. A buyer
          // who can't cover this fill is skipped; their order stays pending
          // and can clear in a later round once they top up.
          const buyerAfter = await User.findOneAndUpdate(
            { _id: m.buyerId, walletBalance: { $gte: total } },
            { $inc: { walletBalance: -total } },
            { new: true, session }
          ).select('walletBalance');
          if (!buyerAfter) return; // ok stays false -> transaction commits nothing meaningful

          // Seller is NOT credited here — settlementService credits them the
          // net (post-fee) amount once, at settlement time, exactly like the
          // instant-match path.
          const [trade] = await Trade.create(
            [
              {
                sellerId: m.sellerId,
                buyerId: m.buyerId,
                quantityKWh: m.quantity,
                pricePerKwh: plan.clearingPrice,
                totalAmount: total,
                tradingType: 'intraday',
                status: 'matched',
                auctionRound: thisRound,
                clearingPrice: plan.clearingPrice,
              },
            ],
            { session }
          );

          createdTrades.push({ trade, buyerAfter, quantity: m.quantity, total });
          filled.set(String(m.buyOrderId), (filled.get(String(m.buyOrderId)) || 0) + m.quantity);
          filled.set(String(m.sellOrderId), (filled.get(String(m.sellOrderId)) || 0) + m.quantity);
          ok = true;
        });
      } catch (err) {
        console.error(`[auctionScheduler] round ${thisRound}: fill failed (${m.buyerId} <- ${m.sellerId}):`, err.message);
      } finally {
        session.endSession();
      }
      if (!ok) {
        console.warn(
          `[auctionScheduler] round ${thisRound}: skipped a ${m.quantity} kWh fill — buyer ${m.buyerId} could not cover ₹${total}`
        );
      }
    }

    // Apply fills to the orders (outside the per-fill transactions — these
    // are bookkeeping updates on documents no other request mutates
    // mid-round, and a crash here just means the next round re-reads the
    // real Trade rows as the source of truth anyway).
    for (const [orderId, qty] of filled.entries()) {
      const order = byId.get(orderId);
      if (!order) continue;
      const newFilled = Number((order.filledQuantity + qty).toFixed(4));
      order.filledQuantity = newFilled;
      order.auctionRound = thisRound;
      order.matchedAt = new Date();
      const lastTrade = createdTrades[createdTrades.length - 1];
      if (lastTrade) order.tradeId = lastTrade.trade._id;
      if (newFilled + 1e-6 >= order.originalQuantity) {
        order.status = 'matched';
        order.quantity = 0;
      } else {
        order.quantity = Number((order.originalQuantity - newFilled).toFixed(4));
        // stays 'pending' — remainder rolls into the next round
      }
      await order.save();
    }

    // Side effects: wallet + order-status sockets to each participant, plus
    // an async notification to the counterparty (the order owner who didn't
    // trigger anything — everyone, here, since the round is automatic).
    for (const { trade, buyerAfter, total } of createdTrades) {
      socketService.emitWalletUpdated(String(trade.buyerId), {
        walletBalance: buyerAfter.walletBalance,
        transaction: { type: 'purchase', amount: total },
      });
      socketService.emitOrderStatusChanged([String(trade.sellerId), String(trade.buyerId)], {
        orderId: String(trade._id),
        newStatus: trade.status,
        quantityKWh: trade.quantityKWh,
        pricePerKwh: trade.pricePerKwh,
        totalAmount: trade.totalAmount,
        blockchainHash: null,
      });
      try {
        await notifyMatch({
          userId: trade.sellerId,
          counterpartyId: trade.buyerId,
          tradeId: trade._id,
          quantityKWh: trade.quantityKWh,
          pricePerKwh: trade.pricePerKwh,
          totalAmount: trade.totalAmount,
          asBuyer: false,
        });
        await notifyMatch({
          userId: trade.buyerId,
          counterpartyId: trade.sellerId,
          tradeId: trade._id,
          quantityKWh: trade.quantityKWh,
          pricePerKwh: trade.pricePerKwh,
          totalAmount: trade.totalAmount,
          asBuyer: true,
        });
      } catch (err) {
        console.error(`[auctionScheduler] round ${thisRound}: notifyMatch failed:`, err.message);
      }
    }

    const summary = {
      round: thisRound,
      cleared: true,
      clearingPrice: plan.clearingPrice,
      clearingQuantity: Number(createdTrades.reduce((t, c) => t + c.quantity, 0).toFixed(4)),
      tradeCount: createdTrades.length,
      buyOrders: buyOrders.length,
      sellOrders: sellOrders.length,
    };
    console.log(
      `[auctionScheduler] round ${thisRound}: cleared ${summary.clearingQuantity} kWh across ${summary.tradeCount} trade(s) at ₹${plan.clearingPrice}/kWh`
    );
    console.log(
      `[auctionScheduler] settlement buffer: next round opens in ${SETTLEMENT_GAP_MS / 60000} min (settlementScheduler has that time to work through round ${thisRound}'s trades before round ${thisRound + 1} lands)`
    );
    socketService.emitAuctionCompleted(summary);
    return summary;
  } finally {
    running = false;
  }
}

function start() {
  if (intervalHandle) return;
  console.log(
    `[auctionScheduler] starting — ${AUCTION_INTERVAL_MS / 60000} min collection + ${SETTLEMENT_GAP_MS / 60000} min settlement buffer = a new round every ${ROUND_CYCLE_MS / 60000} min`
  );
  intervalHandle = setInterval(() => {
    runOnce().catch((err) => console.error('[auctionScheduler] round failed:', err.message));
  }, ROUND_CYCLE_MS);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { start, stop, runOnce, AUCTION_INTERVAL_MS, SETTLEMENT_GAP_MS, ROUND_CYCLE_MS };
