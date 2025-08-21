const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashLoanArbitrage", function () {
  let flashLoanArbitrage;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
    flashLoanArbitrage = await FlashLoanArbitrage.deploy();
    await flashLoanArbitrage.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await flashLoanArbitrage.owner()).to.equal(owner.address);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to execute arbitrage", async function () {
      const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      await expect(
        flashLoanArbitrage.executeArbitrage(usdcAddress, ethers.parseUnits("1000", 6))
      ).to.not.be.reverted;
    });

    it("Should not allow non-owner to execute arbitrage", async function () {
      const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      await expect(
        flashLoanArbitrage.connect(addr1).executeArbitrage(usdcAddress, ethers.parseUnits("1000", 6))
      ).to.be.revertedWithCustomError(flashLoanArbitrage, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to request flash loan", async function () {
      const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      await expect(
        flashLoanArbitrage.requestFlashLoan(usdcAddress, ethers.parseUnits("1000", 6))
      ).to.not.be.reverted;
    });

    it("Should not allow non-owner to request flash loan", async function () {
      const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      await expect(
        flashLoanArbitrage.connect(addr1).requestFlashLoan(usdcAddress, ethers.parseUnits("1000", 6))
      ).to.be.revertedWithCustomError(flashLoanArbitrage, "OwnableUnauthorizedAccount");
    });
  });

  describe("Events", function () {
    it("Should emit ArbitrageExecuted event", async function () {
      const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      const amount = ethers.parseUnits("1000", 6);
      
      await expect(flashLoanArbitrage.executeArbitrage(usdcAddress, amount))
        .to.emit(flashLoanArbitrage, "ArbitrageExecuted")
        .withArgs(usdcAddress, amount, 0);
    });

    it("Should emit FlashLoanRequested event", async function () {
      const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      const amount = ethers.parseUnits("1000", 6);
      
      await expect(flashLoanArbitrage.requestFlashLoan(usdcAddress, amount))
        .to.emit(flashLoanArbitrage, "FlashLoanRequested")
        .withArgs(usdcAddress, amount);
    });
  });
});
