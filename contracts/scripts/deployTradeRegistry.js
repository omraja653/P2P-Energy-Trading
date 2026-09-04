// Standalone deployment for TradeRegistry — deliberately separate from
// scripts/deploy.js (which deploys the currently-live EnergyTrade+Settlement
// pair) and writes to its own deploymentTradeRegistry.json rather than
// touching deployment.json. Not run automatically by anything; only
// deploys when you explicitly run this script.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TradeRegistry with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "MATIC");

  const TradeRegistry = await hre.ethers.getContractFactory("TradeRegistry");
  const tradeRegistry = await TradeRegistry.deploy(deployer.address);
  await tradeRegistry.waitForDeployment();
  const tradeRegistryAddress = await tradeRegistry.getAddress();
  console.log("✅ TradeRegistry deployed to:", tradeRegistryAddress);

  const network = await hre.ethers.provider.getNetwork();
  const deployment = {
    tradeRegistryAddress,
    deployerAddress: deployer.address,
    deploymentDate: new Date().toISOString(),
    network: network.name === "unknown" ? "polygonAmoy" : network.name,
    chainId: Number(network.chainId),
  };

  const outPath = path.join(__dirname, "..", "deploymentTradeRegistry.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\n📄 Saved to ${outPath}`);
  console.log(`🔗 https://amoy.polygonscan.com/address/${tradeRegistryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
