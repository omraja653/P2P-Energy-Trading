const { getEnergyTradeContract, getPlatformWallet } = require('../config/blockchain');

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
 */
async function recordTradeOnChain({ buyerAddress, sellerAddress, quantityKWh, totalAmount }) {
  const wallet = getPlatformWallet();
  const contract = getEnergyTradeContract(wallet);

  const energyAmountWh = Math.round(quantityKWh * 1000);
  const totalPriceWei = Math.round(totalAmount * 1e6);

  const tx = await contract.recordTrade(buyerAddress, sellerAddress, energyAmountWh, totalPriceWei);
  const receipt = await tx.wait();

  return receipt.hash;
}

async function getTradeFromChain(tradeId) {
  const contract = getEnergyTradeContract();
  return contract.getTrade(tradeId);
}

module.exports = { recordTradeOnChain, getTradeFromChain };
