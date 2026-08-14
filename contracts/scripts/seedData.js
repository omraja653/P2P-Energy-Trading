const hre = require("hardhat");

/**
 * Seeds a locally deployed EnergyTrade contract with a few sample trades
 * for demo/testing purposes.
 */
async function main() {
  const energyTradeAddress = process.env.ENERGY_TRADE_CONTRACT_ADDRESS;
  if (!energyTradeAddress) {
    throw new Error("ENERGY_TRADE_CONTRACT_ADDRESS must be set");
  }

  const [, buyer, seller] = await hre.ethers.getSigners();
  const energyTrade = await hre.ethers.getContractAt("EnergyTrade", energyTradeAddress);

  const sampleTrades = [
    { energyAmountWh: 1500, priceEth: "0.015" },
    { energyAmountWh: 3000, priceEth: "0.03" },
    { energyAmountWh: 750, priceEth: "0.0075" },
  ];

  for (const { energyAmountWh, priceEth } of sampleTrades) {
    const tx = await energyTrade.recordTrade(
      buyer.address,
      seller.address,
      energyAmountWh,
      hre.ethers.parseEther(priceEth)
    );
    await tx.wait();
    console.log(`Seeded trade: ${energyAmountWh} Wh for ${priceEth} ETH`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
