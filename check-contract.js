require('dotenv').config();
const { ethers } = require('ethers');

async function checkContract() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.WALLET_KEY, provider);
  
  const contractAddress = process.env.CONTRACT_ADDRESS;
  console.log('🔍 Checking contract status...');
  console.log('Contract Address:', contractAddress);
  console.log('Your Wallet:', wallet.address);
  
  // Token addresses
  const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const DAI = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';
  const WETH = '0x4200000000000000000000000000000000000006';
  
  // Check contract balances
  const usdcContract = new ethers.Contract(USDC, ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'], provider);
  const daiContract = new ethers.Contract(DAI, ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'], provider);
  const wethContract = new ethers.Contract(WETH, ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'], provider);
  
  try {
    const usdcBalance = await usdcContract.balanceOf(contractAddress);
    const daiBalance = await daiContract.balanceOf(contractAddress);
    const wethBalance = await wethContract.balanceOf(contractAddress);
    
    console.log('\n💰 Contract Token Balances:');
    console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    console.log(`   DAI: ${ethers.formatUnits(daiBalance, 18)} DAI`);
    console.log(`   WETH: ${ethers.formatUnits(wethBalance, 18)} WETH`);
    
    // Check your wallet balances
    const yourUsdcBalance = await usdcContract.balanceOf(wallet.address);
    const yourDaiBalance = await daiContract.balanceOf(wallet.address);
    const yourWethBalance = await wethContract.balanceOf(wallet.address);
    
    console.log('\n💳 Your Wallet Balances:');
    console.log(`   USDC: ${ethers.formatUnits(yourUsdcBalance, 6)} USDC`);
    console.log(`   DAI: ${ethers.formatUnits(yourDaiBalance, 18)} DAI`);
    console.log(`   WETH: ${ethers.formatUnits(yourWethBalance, 18)} WETH`);
    
    // Check contract settings
    const contract = new ethers.Contract(
      contractAddress,
      [
        'function owner() view returns (address)',
        'function minProfitThreshold() view returns (uint256)',
        'function maxSlippage() view returns (uint256)',
        'function emergencyStop() view returns (bool)'
      ],
      provider
    );
    
    const owner = await contract.owner();
    const minProfit = await contract.minProfitThreshold();
    const maxSlippage = await contract.maxSlippage();
    const emergencyStop = await contract.emergencyStop();
    
    console.log('\n⚙️ Contract Settings:');
    console.log(`   Owner: ${owner}`);
    console.log(`   Your wallet: ${wallet.address}`);
    console.log(`   Are you owner? ${owner === wallet.address ? 'YES' : 'NO'}`);
    console.log(`   Min Profit: ${ethers.formatUnits(minProfit, 6)} USDC`);
    console.log(`   Max Slippage: ${maxSlippage / 100}%`);
    console.log(`   Emergency Stop: ${emergencyStop ? 'ACTIVE' : 'INACTIVE'}`);
    
    // Check if contract has any tokens for trading
    if (usdcBalance === 0n && daiBalance === 0n && wethBalance === 0n) {
      console.log('\n🚨 PROBLEM FOUND: Contract has NO tokens!');
      console.log('   The contract needs USDC or DAI to perform arbitrage.');
      console.log('   You need to fund the contract first.');
    } else {
      console.log('\n✅ Contract has tokens available for trading.');
    }
    
  } catch (error) {
    console.error('❌ Error checking contract:', error.message);
  }
}

checkContract().catch(console.error);
