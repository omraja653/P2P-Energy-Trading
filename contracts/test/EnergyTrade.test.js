const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EnergyTrade", function () {
  async function deployFixture() {
    const [owner, buyer, seller] = await ethers.getSigners();
    const EnergyTrade = await ethers.getContractFactory("EnergyTrade");
    const energyTrade = await EnergyTrade.deploy(owner.address);
    return { energyTrade, owner, buyer, seller };
  }

  it("records a trade and stores its details", async function () {
    const { energyTrade, buyer, seller } = await deployFixture();

    const tx = await energyTrade.recordTrade(buyer.address, seller.address, 1000, ethers.parseEther("0.01"));
    await tx.wait();

    const trade = await energyTrade.getTrade(1);
    expect(trade.buyer).to.equal(buyer.address);
    expect(trade.seller).to.equal(seller.address);
    expect(trade.energyAmountWh).to.equal(1000);
    expect(trade.settled).to.equal(false);
  });

  it("reverts when recording a trade with a zero address", async function () {
    const { energyTrade, seller } = await deployFixture();
    await expect(
      energyTrade.recordTrade(ethers.ZeroAddress, seller.address, 1000, ethers.parseEther("0.01"))
    ).to.be.revertedWith("EnergyTrade: zero address");
  });

  it("reverts when a non-owner tries to record a trade", async function () {
    const { energyTrade, buyer, seller } = await deployFixture();
    await expect(
      energyTrade.connect(buyer).recordTrade(buyer.address, seller.address, 1000, ethers.parseEther("0.01"))
    ).to.be.reverted;
  });
});
