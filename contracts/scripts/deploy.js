const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS || deployer.address;
  const platformFeeBps = 200; // 2%

  const EnergyTrade = await hre.ethers.getContractFactory("EnergyTrade");
  const energyTrade = await EnergyTrade.deploy(deployer.address);
  await energyTrade.waitForDeployment();
  console.log("EnergyTrade deployed to:", await energyTrade.getAddress());

  const Settlement = await hre.ethers.getContractFactory("Settlement");
  const settlement = await Settlement.deploy(
    deployer.address,
    await energyTrade.getAddress(),
    platformWallet,
    platformFeeBps
  );
  await settlement.waitForDeployment();
  console.log("Settlement deployed to:", await settlement.getAddress());

  const tx = await energyTrade.setSettlementContract(await settlement.getAddress());
  await tx.wait();
  console.log("Settlement contract linked to EnergyTrade");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
