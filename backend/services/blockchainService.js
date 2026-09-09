const { getEnergyTradeContract, getSettlementContract, getPlatformWallet } = require('../config/blockchain');

/**
 * Real bug fixed here: this used to pass Mongo `buyerId`/`sellerId`
 * (ObjectId strings) straight into the contract's `address` params, and
 * `quantityKWh`/`totalAmount` (plain floats, e.g. 2.5 / 0.132) into its
 * `uint256` params — every call threw ("unsupported addressable value"
 * from ethers, or an underflow on a non-integer), so on-chain settlement
 * never actually succeeded, confirmed live while investigating this.
 *
 * Now takes the buyer/seller's real `walletAddress` (see User.js — every
 * account gets one, not just seed data) and converts the trade's
 * kWh/₹ figures into integers the way the contract's own field names say
 * to: `energyAmountWh` (Watt-hours, not kWh — ×1000) and `totalPriceWei`.
 * There's no real fiat-to-crypto exchange happening in this app (a trade's
 * money side is this app's own walletBalance ledger, not on-chain value
 * transfer), so "Wei" here is honestly just an integer scaling of the
 * rupee amount (×1e6, i.e. 6 decimal places of precision) recorded
 * on-chain as an immutable proof/audit trail — not a real currency
 * conversion, and not an actual value transfer between the addresses.
 *
 * Also returns the real on-chain trade id (needed to later call
 * Settlement.settleTrade(tradeId) — see settleOnChain below), parsed from
 * the TradeRecorded event log. A mined receipt for a state-changing call
 * doesn't carry the function's return value the way a `view` call's
 * response does, so the event is the only way to recover it.
 */
async function recordTradeOnChain({ buyerAddress, sellerAddress, quantityKWh, totalAmount }) {
  const wallet = getPlatformWallet();
  const contract = getEnergyTradeContract(wallet);

  const energyAmountWh = Math.round(quantityKWh * 1000);
  const totalPriceWei = Math.round(totalAmount * 1e6);

  const tx = await contract.recordTrade(buyerAddress, sellerAddress, energyAmountWh, totalPriceWei);
  const receipt = await tx.wait();

  let onChainTradeId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === 'TradeRecorded') {
        onChainTradeId = parsed.args.tradeId;
        break;
      }
    } catch {
      // Not one of this contract's events (e.g. a log from another
      // contract in the same block) — ignore and keep looking.
    }
  }

  return { txHash: receipt.hash, onChainTradeId, totalPriceWei };
}

async function getTradeFromChain(tradeId) {
  const contract = getEnergyTradeContract();
  return contract.getTrade(tradeId);
}

/**
 * Calls the real, deployed Settlement contract's `settleTrade(tradeId)` —
 * `payable`, `onlyOwner`. This is a genuine second on-chain transaction,
 * not a simulation: the platform wallet sends `totalPriceWei` of real
 * (testnet) MATIC as `msg.value`, and the contract forwards it on-chain
 * to the seller's address (minus its own platform fee cut) via
 * `energyTrade.markSettled` + a raw value transfer. Flagged plainly, not
 * hidden: `totalPriceWei` is the same deliberately-scaled proxy value
 * recordTradeOnChain uses (real ₹ amount × 1e6) — it does not represent
 * the trade's real ₹ value in MATIC, so the amount actually moved
 * on-chain here is real but economically meaningless, not a real
 * settlement payment. This app's actual money movement is the
 * walletBalance ledger (routes/trades.js, slotMatchingService.js); this
 * on-chain leg is proof/audit trail, same spirit as recordTradeOnChain.
 */
async function settleOnChain(onChainTradeId, totalPriceWei) {
  const wallet = getPlatformWallet();
  const contract = getSettlementContract(wallet);

  const tx = await contract.settleTrade(onChainTradeId, { value: totalPriceWei });
  const receipt = await tx.wait();

  return receipt.hash;
}

module.exports = { recordTradeOnChain, getTradeFromChain, settleOnChain };
