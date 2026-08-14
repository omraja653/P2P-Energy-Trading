# P2P Energy Trading Platform - Smart Contracts

Solidity smart contracts deployed on Polygon Amoy testnet.

## Setup

```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network polygonAmoy
```

## Contracts
- `EnergyTrade.sol` - Escrow & trade recording logic
- `Settlement.sol` - Payment distribution
- `Interfaces/IEnergyTrade.sol` - Shared interface

## Testing

```bash
npx hardhat test
```
