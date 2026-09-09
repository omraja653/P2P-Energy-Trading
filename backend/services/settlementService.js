const { Settlement, User } = require('../models');
const SystemSettings = require('../models/SystemSettings');
const { recordTradeOnChain, settleOnChain } = require('./blockchainService');
const socketService = require('./socket');

// Fallback defaults if SystemSettings can't be read for some reason — kept
// in sync with the schema defaults in models/SystemSettings.js.
const PLATFORM_FEE_RATE = 0.02; // 2% platform service fee
const GRID_WHEEL_RATE = 0.08; // 8% grid wheeling/transport fee

/**
 * Splits a trade's totalAmount three ways (prosumer payout, grid wheeling
 * fee, platform fee), records the settlement, and pushes it on-chain. Fee
 * rates come from the admin-editable SystemSettings singleton (Admin →
 * Settings), falling back to the constants above only if that read fails.
 */
async function settleTrade(trade) {
  let platformFeeRate = PLATFORM_FEE_RATE;
  let gridWheelRate = GRID_WHEEL_RATE;
  try {
    const settings = await SystemSettings.getSingleton();
    platformFeeRate = settings.platformFeeRate;
    gridWheelRate = settings.gridWheelRate;
  } catch (err) {
    console.error('Could not read SystemSettings, using fallback fee rates:', err.message);
  }

  const platformAmount = Number((trade.totalAmount * platformFeeRate).toFixed(4));
  const gridWheelAmount = Number((trade.totalAmount * gridWheelRate).toFixed(4));
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
    // Real fix: recordTradeOnChain needs actual wallet addresses, not raw
    // Mongo ids (see blockchainService.js) — trade.buyerId/sellerId here
    // are unpopulated ObjectId refs, so look the users up.
    const [buyer, seller] = await Promise.all([
      User.findById(trade.buyerId).select('walletAddress'),
      User.findById(trade.sellerId).select('walletAddress'),
    ]);
    if (!buyer?.walletAddress || !seller?.walletAddress) {
      throw new Error(
        `Cannot settle on-chain: ${!buyer?.walletAddress ? 'buyer' : 'seller'} has no linked wallet address`
      );
    }

    const { txHash, onChainTradeId, totalPriceWei } = await recordTradeOnChain({
      buyerAddress: buyer.walletAddress,
      sellerAddress: seller.walletAddress,
      quantityKWh: trade.quantityKWh,
      totalAmount: trade.totalAmount,
    });

    settlement.blockchainTxHash = txHash;
    if (onChainTradeId != null) settlement.onChainTradeId = onChainTradeId.toString();

    // Settlement.sol's own settleTrade(tradeId) call — a second, separate
    // on-chain transaction (see blockchainService.settleOnChain for what
    // it actually does and why the amount it moves is real MATIC but
    // economically meaningless). Best-effort and non-fatal on purpose:
    // the settlement this function exists to do — the real fee split and
    // the EnergyTrade audit record above — already succeeded by this
    // point, and this second leg is decorative/proof-of-concept, not the
    // thing Wallet.jsx/TradeHistory.jsx's settlement figures depend on.
    // A failure here (e.g. the platform wallet running low on testnet
    // MATIC) shouldn't undo or block a real, already-successful settlement.
    if (onChainTradeId != null) {
      try {
        settlement.settlementContractTxHash = await settleOnChain(onChainTradeId, totalPriceWei);
      } catch (settlementContractErr) {
        console.error(
          `Settlement.settleTrade on-chain call failed for trade ${trade._id} (tradeId ${onChainTradeId}):`,
          settlementContractErr.message
        );
      }
    }

    // Real design change from an earlier fix: the seller used to be
    // credited the FULL gross totalAmount at match time, with this
    // function deducting the fee back out at settlement time to arrive
    // at the net figure. That worked, but needed a negative-balance
    // guard (a role-switched seller could spend the gross credit as a
    // consumer before settlement ran) and briefly showed the wrong
    // number in between. Now the seller is never credited at match time
    // at all (see slotMatchingService.js / routes/trades.js) — this is
    // their one and only credit, for exactly prosumerAmount. Purely
    // additive, so no balance-gate is needed here.
    if (prosumerAmount > 0) {
      const sellerAfter = await User.findByIdAndUpdate(
        trade.sellerId,
        { $inc: { walletBalance: prosumerAmount } },
        { new: true }
      ).select('walletBalance');
      socketService.emitWalletUpdated(trade.sellerId, {
        walletBalance: sellerAfter.walletBalance,
        transaction: { type: 'sale', amount: prosumerAmount },
      });
    }

    settlement.status = 'completed';
    settlement.settledAt = new Date();
    await settlement.save();
  } catch (err) {
    settlement.status = 'failed';
    await settlement.save();
    throw err;
  }

  return settlement;
}

/**
 * Shared by the admin-triggered route and the automatic scheduler
 * (jobs/settlementScheduler.js) — settles a trade, updates its status/
 * blockchain fields, and emits the same live event either path already
 * relied on, so the two callers can't drift into duplicating (or
 * disagreeing on) this bookkeeping.
 */
async function settleTradeAndUpdateTrade(trade) {
  const settlement = await settleTrade(trade);
  trade.status = 'settled';
  trade.blockchainTxHash = settlement.blockchainTxHash;
  trade.settledAt = settlement.settledAt;
  await trade.save();

  socketService.emitOrderStatusChanged([String(trade.sellerId), String(trade.buyerId)], {
    orderId: String(trade._id),
    newStatus: trade.status,
    blockchainHash: trade.blockchainTxHash,
  });

  return settlement;
}

module.exports = { settleTrade, settleTradeAndUpdateTrade, PLATFORM_FEE_RATE, GRID_WHEEL_RATE };
