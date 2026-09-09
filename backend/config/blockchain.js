const { JsonRpcProvider, Wallet, Contract } = require('ethers');

const RPC_URL = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology/';
const CONTRACT_ADDRESS = process.env.ENERGY_TRADE_CONTRACT_ADDRESS;
const CONTRACT_ABI = (() => {
  try {
    return JSON.parse(process.env.ENERGY_TRADE_ABI || '[]');
  } catch {
    return [];
  }
})();

// Settlement.sol — deployed alongside EnergyTrade (see contracts/deployment.json)
// but never actually called from this codebase until now. Its real
// interface, read from the Solidity source (contracts/contracts/Settlement.sol),
// is nothing like a generic "settle this trade" call: `settleTrade(uint256
// tradeId)` is `payable` and `onlyOwner` — it requires the caller to send
// `msg.value` exactly equal to the trade's on-chain `totalPriceWei` (a
// real, on-chain MATIC transfer to the seller, minus a platform fee), not
// a set of (seller, buyer, amount, timestamp) arguments. Only this minimal
// fragment is needed, so it's hand-written here rather than pulled from a
// giant compiled-artifact ABI env var the way EnergyTrade's is.
const SETTLEMENT_CONTRACT_ADDRESS = process.env.SETTLEMENT_CONTRACT_ADDRESS;
const SETTLEMENT_ABI = [
  'function settleTrade(uint256 tradeId) external payable',
];

function getProvider() {
  return new JsonRpcProvider(RPC_URL);
}

function getPlatformWallet() {
  const privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PLATFORM_PRIVATE_KEY is not set');
  }
  return new Wallet(privateKey, getProvider());
}

function getEnergyTradeContract(signerOrProvider = getProvider()) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('ENERGY_TRADE_CONTRACT_ADDRESS is not set');
  }
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
}

function getSettlementContract(signerOrProvider = getProvider()) {
  if (!SETTLEMENT_CONTRACT_ADDRESS) {
    throw new Error('SETTLEMENT_CONTRACT_ADDRESS is not set');
  }
  return new Contract(SETTLEMENT_CONTRACT_ADDRESS, SETTLEMENT_ABI, signerOrProvider);
}

module.exports = {
  getProvider,
  getPlatformWallet,
  getEnergyTradeContract,
  getSettlementContract,
};
