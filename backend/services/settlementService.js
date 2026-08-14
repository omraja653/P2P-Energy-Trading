const { Settlement } = require('../models');
const { recordTradeOnChain } = require('./blockchainService');

const PLATFORM_FEE_RATE = 0.02; // 2%

async function settleTrade(trade) {
  const platformFee = Number((trade.totalPrice * PLATFORM_FEE_RATE).toFixed(4));
  const amountSettled = Number((trade.totalPrice - platformFee).toFixed(4));

  const settlement = await Settlement.create({
    trade: trade._id,
    amountSettled,
    platformFee,
    status: 'pending',
  });

  try {
    const txHash = await recordTradeOnChain({
      buyer: trade.buyer,
      seller: trade.seller,
      energyAmountKwh: trade.energyAmountKwh,
      totalPrice: trade.totalPrice,
    });

    settlement.status = 'completed';
    settlement.settledTxHash = txHash;
    settlement.settledAt = new Date();
    await settlement.save();
  } catch (err) {
    settlement.status = 'failed';
    await settlement.save();
    throw err;
  }

  return settlement;
}

module.exports = { settleTrade, PLATFORM_FEE_RATE };
