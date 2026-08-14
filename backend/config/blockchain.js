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

module.exports = {
  getProvider,
  getPlatformWallet,
  getEnergyTradeContract,
};
