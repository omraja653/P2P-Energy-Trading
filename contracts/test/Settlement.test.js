const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Settlement", function () {
  const FEE_BPS = 200; // 2%
  const PRICE = ethers.parseEther("1");

  async function deployFixture() {
    const [owner, buyer, seller, platformWallet] = await ethers.getSigners();

    const EnergyTrade = await ethers.getContractFactory("EnergyTrade");
    const energyTrade = await EnergyTrade.deploy(owner.address);

    const Settlement = await ethers.getContractFactory("Settlement");
    const settlement = await Settlement.deploy(
      owner.address,
      await energyTrade.getAddress(),
      platformWallet.address,
      FEE_BPS
    );

    await energyTrade.setSettlementContract(await settlement.getAddress());
    await energyTrade.recordTrade(buyer.address, seller.address, 1000, PRICE);

    return { energyTrade, settlement, owner, buyer, seller, platformWallet };
  }

  it("pays the seller and platform wallet on settlement", async function () {
    const { settlement, seller, platformWallet } = await deployFixture();

    const sellerBefore = await ethers.provider.getBalance(seller.address);
    const platformBefore = await ethers.provider.getBalance(platformWallet.address);

    await settlement.settleTrade(1, { value: PRICE });

    const expectedFee = (PRICE * BigInt(FEE_BPS)) / 10_000n;
    const expectedSeller = PRICE - expectedFee;

    expect(await ethers.provider.getBalance(seller.address)).to.equal(sellerBefore + expectedSeller);
    expect(await ethers.provider.getBalance(platformWallet.address)).to.equal(platformBefore + expectedFee);
  });

  it("marks the underlying trade as settled", async function () {
    const { settlement, energyTrade } = await deployFixture();
    await settlement.settleTrade(1, { value: PRICE });
    const trade = await energyTrade.getTrade(1);
    expect(trade.settled).to.equal(true);
  });

  it("reverts when payment does not match the trade price", async function () {
    const { settlement } = await deployFixture();
    await expect(settlement.settleTrade(1, { value: ethers.parseEther("0.5") })).to.be.revertedWith(
      "Settlement: incorrect payment amount"
    );
  });
});
