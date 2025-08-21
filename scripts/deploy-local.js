const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying FlashLoanArbitrage contract...");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
  const contract = await FlashLoanArbitrage.deploy();
  
  console.log("⏳ Waiting for deployment...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ FlashLoanArbitrage deployed to:", contractAddress);
  
  console.log("\n📋 Contract Details:");
  console.log("   Owner:", await contract.owner());
  console.log("   Uniswap Router:", "0x3fC91A91Bb20D209B20d4a4F5FC58f3A4BfA1E7C");
  console.log("   Sushiswap Router:", "0x6e086AbE2ECB3f660b15Fb3a3ef0028BE6a4a1e0");
  console.log("   USDC:", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  console.log("   DAI:", "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb");
  
  console.log("\n🔧 Next steps:");
  console.log("   1. Add CONTRACT_ADDRESS=" + contractAddress + " to your .env file");
  console.log("   2. Run: node bot.js");
  console.log("   3. Or test with: npx hardhat test");
}

main().catch((error) => {
  console.error("💥 Deployment failed:", error);
  process.exitCode = 1;
});
