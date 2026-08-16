const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "MATIC");

  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS || deployer.address;
  const platformFeeBps = 200; // 2%

  const EnergyTrade = await hre.ethers.getContractFactory("EnergyTrade");
  const energyTrade = await EnergyTrade.deploy(deployer.address);
  await energyTrade.waitForDeployment();
  const energyTradeAddress = await energyTrade.getAddress();
  console.log("✅ EnergyTrade deployed to:", energyTradeAddress);

  const Settlement = await hre.ethers.getContractFactory("Settlement");
  const settlement = await Settlement.deploy(
    deployer.address,
    energyTradeAddress,
    platformWallet,
    platformFeeBps
  );
  await settlement.waitForDeployment();
  const settlementAddress = await settlement.getAddress();
  console.log("✅ Settlement deployed to:", settlementAddress);

  const tx = await energyTrade.setSettlementContract(settlementAddress);
  await tx.wait();
  console.log("✅ Settlement contract linked to EnergyTrade");

  const network = await hre.ethers.provider.getNetwork();
  const deployment = {
    energyTradeAddress,
    settlementAddress,
    deployerAddress: deployer.address,
    platformWalletAddress: platformWallet,
    platformFeeBps,
    deploymentDate: new Date().toISOString(),
    network: hre.network.name,
    chainId: Number(network.chainId),
  };

  const outPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log("\n✅ Deployment saved to", outPath);
  console.log(JSON.stringify(deployment, null, 2));
  console.log(
    "\nNext: copy energyTradeAddress into backend/.env (ENERGY_TRADE_CONTRACT_ADDRESS) " +
      "and frontend/.env (VITE_ENERGY_TRADE_CONTRACT_ADDRESS)."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
