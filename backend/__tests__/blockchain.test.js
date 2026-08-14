const { getEnergyTradeContract, getPlatformWallet } = require('../config/blockchain');

describe('blockchain config', () => {
  it('throws when the contract address is not configured', () => {
    delete process.env.ENERGY_TRADE_CONTRACT_ADDRESS;
    expect(() => getEnergyTradeContract()).toThrow();
  });

  it('throws when the platform private key is not configured', () => {
    delete process.env.PLATFORM_PRIVATE_KEY;
    expect(() => getPlatformWallet()).toThrow();
  });
});
