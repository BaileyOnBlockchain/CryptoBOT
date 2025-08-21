const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying FlashLoanArbitrage to Base Mainnet...");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // Check if we have the required environment variables
  if (!process.env.WALLET_KEY) {
    console.error("❌ WALLET_KEY not found in environment variables");
    console.log("Please set your private key in .env file");
    process.exit(1);
  }

  // Get current gas price
  const gasPrice = await ethers.provider.getFeeData();

  // Get deployer's ETH balance before deployment
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.error("❌ Insufficient ETH balance for deployment");
    console.log("You need at least 0.01 ETH for gas fees");
    process.exit(1);
  }

  console.log("\n⚠️  WARNING: This will deploy to Base Mainnet with REAL costs!");
  console.log("   - Gas fees will be deducted from your wallet");
  console.log("   - Contract will be live on mainnet");
  console.log("   - Ensure you have sufficient ETH for deployment\n");

  // Deploy the contract
  const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
  console.log("📦 Contract factory created successfully");
  
  const contract = await FlashLoanArbitrage.deploy({
    gasLimit: 3000000, // Increased gas limit
    maxFeePerGas: gasPrice.maxFeePerGas || gasPrice.gasPrice,
    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei")
  });
  
  console.log("🚀 Deployment transaction sent:", contract.deploymentTransaction()?.hash);

  console.log("⏳ Waiting for deployment confirmation...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ FlashLoanArbitrage deployed to:", contractAddress);

  // Wait a bit for the contract to be fully ready
  console.log("⏳ Waiting for contract to be ready...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("\n📋 Contract Details:");
  
  try {
    const owner = await contract.owner();
    console.log("   Owner:", owner);
  } catch (error) {
    console.log("   Owner: Error reading owner -", error.message);
  }
  
  try {
    const uniswapRouter = await contract.UNISWAP_V3_ROUTER();
    console.log("   Uniswap V3 Router:", uniswapRouter);
  } catch (error) {
    console.log("   Uniswap V3 Router: Error reading -", error.message);
  }
  
  try {
    const sushiswapRouter = await contract.SUSHISWAP_V2_ROUTER();
    console.log("   Sushiswap V2 Router:", sushiswapRouter);
  } catch (error) {
    console.log("   Sushiswap V2 Router: Error reading -", error.message);
  }
  
  try {
    const usdc = await contract.USDC();
    console.log("   USDC:", usdc);
  } catch (error) {
    console.log("   USDC: Error reading -", error.message);
  }
  
  try {
    const dai = await contract.DAI();
    console.log("   DAI:", dai);
  } catch (error) {
    console.log("   DAI: Error reading -", error.message);
  }
  
  try {
    const minProfit = await contract.minProfitThreshold();
    console.log("   Min Profit Threshold:", ethers.formatUnits(minProfit, 6), "USDC");
  } catch (error) {
    console.log("   Min Profit Threshold: Error reading -", error.message);
  }
  
  try {
    const maxSlippage = await contract.maxSlippage();
    console.log("   Max Slippage:", Number(maxSlippage) / 100, "%");
  } catch (error) {
    console.log("   Max Slippage: Error reading -", error.message);
  }

  console.log("\n🔧 Next steps:");
  console.log("   1. Update your .env file with:");
  console.log("      CONTRACT_ADDRESS=" + contractAddress);
  console.log("   2. Fund the contract with USDC/DAI for arbitrage");
  console.log("   3. Run: npm start");
  console.log("   4. Monitor on BaseScan: https://basescan.org/address/" + contractAddress);

  console.log("\n⚠️  IMPORTANT SECURITY NOTES:");
  console.log("   - Keep your private key secure");
  console.log("   - Test thoroughly before using real funds");
  console.log("   - Monitor the contract for any issues");
  console.log("   - Have emergency stop procedures ready");
}

main().catch((error) => {
  console.error("💥 Deployment failed:", error);
  process.exitCode = 1;
});
