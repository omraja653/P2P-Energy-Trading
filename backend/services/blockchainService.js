const { getEnergyTradeContract, getPlatformWallet } = require('../config/blockchain');

async function recordTradeOnChain({ buyerId, sellerId, quantityKWh, totalAmount }) {
  const wallet = getPlatformWallet();
  const contract = getEnergyTradeContract(wallet);

  const tx = await contract.recordTrade(buyerId, sellerId, quantityKWh, totalAmount);
  const receipt = await tx.wait();

  return receipt.hash;
}

async function getTradeFromChain(tradeId) {
  const contract = getEnergyTradeContract();
  return contract.getTrade(tradeId);
}

module.exports = { recordTradeOnChain, getTradeFromChain };
