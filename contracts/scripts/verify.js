const hre = require("hardhat");

async function main() {
  const energyTradeAddress = process.env.ENERGY_TRADE_CONTRACT_ADDRESS;
  const settlementAddress = process.env.SETTLEMENT_CONTRACT_ADDRESS;
  const deployerAddress = process.env.DEPLOYER_ADDRESS;
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;

  if (!energyTradeAddress || !deployerAddress) {
    throw new Error("ENERGY_TRADE_CONTRACT_ADDRESS and DEPLOYER_ADDRESS must be set");
  }

  await hre.run("verify:verify", {
    address: energyTradeAddress,
    constructorArguments: [deployerAddress],
  });

  if (settlementAddress) {
    await hre.run("verify:verify", {
      address: settlementAddress,
      constructorArguments: [deployerAddress, energyTradeAddress, platformWallet, 200],
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
