const { Settlement } = require('../models');
const { recordTradeOnChain } = require('./blockchainService');

const PLATFORM_FEE_RATE = 0.02; // 2% platform service fee
const GRID_WHEEL_RATE = 0.08; // 8% grid wheeling/transport fee

/**
 * Splits a trade's totalAmount three ways (prosumer payout, grid wheeling
 * fee, platform fee), records the settlement, and pushes it on-chain.
 */
async function settleTrade(trade) {
  const platformAmount = Number((trade.totalAmount * PLATFORM_FEE_RATE).toFixed(4));
  const gridWheelAmount = Number((trade.totalAmount * GRID_WHEEL_RATE).toFixed(4));
  const prosumerAmount = Number((trade.totalAmount - platformAmount - gridWheelAmount).toFixed(4));

  // T+1 settlement cycle: due the day after the trade is settled.
  const t1Date = new Date();
  t1Date.setDate(t1Date.getDate() + 1);

  const settlement = await Settlement.create({
    tradeId: trade._id,
    prosumerAmount,
    gridWheelAmount,
    platformAmount,
    status: 'pending',
    T1Date: t1Date,
  });

  try {
    const txHash = await recordTradeOnChain({
      buyerId: trade.buyerId,
      sellerId: trade.sellerId,
      quantityKWh: trade.quantityKWh,
      totalAmount: trade.totalAmount,
    });

    settlement.status = 'completed';
    settlement.blockchainTxHash = txHash;
    settlement.settledAt = new Date();
    await settlement.save();
  } catch (err) {
    settlement.status = 'failed';
    await settlement.save();
    throw err;
  }

  return settlement;
}

module.exports = { settleTrade, PLATFORM_FEE_RATE, GRID_WHEEL_RATE };
