require('dotenv').config();
const { ethers } = require('ethers');
const PerformanceMonitor = require('./monitoring/performance-monitor');
const AlertSystem = require('./monitoring/alert-system');

// Check if environment variables are set
if (!process.env.WALLET_KEY) {
  console.error('❌ WALLET_KEY not found in environment variables');
  console.log('Please create a .env file with your private key');
  process.exit(1);
}

// Contract address is hardcoded to the funded contract

// Initialize monitoring systems
const performanceMonitor = new PerformanceMonitor();
const alertSystem = new AlertSystem();

// Mainnet configuration
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(process.env.WALLET_KEY, provider);
const contractAddress = '0x3aeB8076fCcaa67B446E2ffB54113F0C4D999573';

// Enhanced ABI for mainnet functionality
const abi = [
  'function executeArbitrage(address _token, uint256 _amount) external',
  'function requestFlashLoan(address _token, uint256 _amount) public',
  'event ArbitrageExecuted(address token, uint256 amount, uint256 profit)',
  'event FlashLoanRequested(address token, uint256 amount)'
];

const contract = new ethers.Contract(contractAddress, abi, wallet);

// Mainnet token addresses
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DAI = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';
const WETH = '0x4200000000000000000000000000000000000006';

// Configurable parameters
const AMOUNT = ethers.parseUnits(process.env.TRADE_AMOUNT || '100', 6); // Default 100 USDC
const MIN_PROFIT_USD = ethers.parseUnits(process.env.MIN_PROFIT || '5', 6); // Minimum $5 profit
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '30000'); // 30 seconds default

console.log('🤖 Enhanced CryptoBot Starting on Base Mainnet...');
console.log(`📍 Network: Base Mainnet`);
console.log(`👛 Wallet: ${wallet.address}`);
console.log(`📋 Contract: ${contractAddress}`);
console.log(`💰 Trade Amount: ${ethers.formatUnits(AMOUNT, 6)} USDC`);
console.log(`💵 Min Profit: $${ethers.formatUnits(MIN_PROFIT_USD, 6)}`);
console.log(`⏱️  Check Interval: ${CHECK_INTERVAL/1000} seconds`);
console.log(`📊 Performance monitoring: ENABLED`);
console.log(`🚨 Alert system: ${alertSystem.alertsEnabled ? 'ENABLED' : 'DISABLED'}`);

// Enhanced price fetching with real DEX integration and monitoring
async function getUniswapV3Price(tokenIn, tokenOut, amountIn) {
  const startTime = Date.now();
  
  try {
    // Uniswap V3 Quoter contract for price estimation
    const quoterABI = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
    ];
    
    const quoterAddress = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a'; // Base mainnet
    const quoter = new ethers.Contract(quoterAddress, quoterABI, provider);
    
    // Try different fee tiers (0.05%, 0.3%, 1%)
    const fees = [500, 3000, 10000];
    
    for (const fee of fees) {
      try {
        const amountOut = await quoter.quoteExactInputSingle(
          tokenIn, tokenOut, fee, amountIn, 0
        );
        
        // Record price data for monitoring
        await performanceMonitor.recordPriceData({
          tokenIn,
          tokenOut,
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          dex: 'Uniswap V3',
          feeTier: `${fee/10000}%`
        });
        
        return { amountOut, fee };
      } catch (e) {
        continue; // Try next fee tier
      }
    }
    
    throw new Error('No valid pool found');
  } catch (error) {
    console.error('❌ Uniswap V3 price fetch failed:', error.message);
    return null;
  } finally {
    const executionTime = Date.now() - startTime;
    console.log(`⏱️  Uniswap V3 price fetch took ${executionTime}ms`);
  }
}

async function getSushiswapV2Price(tokenIn, tokenOut, amountIn) {
  const startTime = Date.now();
  
  try {
    // Sushiswap V2 Router for price estimation
    const routerABI = [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
    ];
    
    const routerAddress = '0x6e086AbE2ECB3f660b15Fb3a3ef0028BE6a4a1e0'; // Base mainnet
    const router = new ethers.Contract(routerAddress, routerABI, provider);
    
    const path = [tokenIn, tokenOut];
    const amounts = await router.getAmountsOut(amountIn, path);
    
    // Record price data for monitoring
    await performanceMonitor.recordPriceData({
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      amountOut: amounts[1].toString(),
      dex: 'Sushiswap V2',
      feeTier: '0.3%'
    });
    
    return amounts[1];
  } catch (error) {
    console.error('❌ Sushiswap V2 price fetch failed:', error.message);
    return null;
  } finally {
    const executionTime = Date.now() - startTime;
    console.log(`⏱️  Sushiswap V2 price fetch took ${executionTime}ms`);
  }
}

async function checkProfitability() {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Fetching real-time prices...');
    
    // Get real prices from DEXes
    const uniQuote = await getUniswapV3Price(USDC, DAI, AMOUNT);
    const sushiQuote = await getSushiswapV2Price(DAI, USDC, uniQuote?.amountOut || AMOUNT);
    
    if (!uniQuote || !sushiQuote) {
      console.log('⚠️  Unable to fetch prices from one or more DEXes');
      return { profitable: false, profit: 0n, gasCost: 0n, reason: 'Price fetch failed' };
    }
    
    // Calculate potential profit
    const input = AMOUNT;
    const outputUni = uniQuote.amountOut;
    const outputSushi = sushiQuote;
    
    // Estimate gas costs (more accurate for mainnet)
    const gasEst = await contract.executeArbitrage.estimateGas(USDC, AMOUNT);
    const gasPrice = await provider.getFeeData();
    const gasCost = gasEst * gasPrice.gasPrice;
    
    // Convert gas cost from ETH to USDC equivalent for proper profit calculation
    const ethPriceUsd = 2000n; // Approximate ETH price in USD
    const gasCostUsd = (gasCost * ethPriceUsd) / ethers.parseUnits('1', 18); // Convert to USD
    
    const profit = outputSushi - input - gasCostUsd;
    const profitUsd = ethers.formatUnits(profit, 6);
    const gasCostEth = ethers.formatEther(gasCost);

    console.log(`📊 Real Price Analysis:`);
    console.log(`   Uniswap V3 USDC→DAI: ${ethers.formatUnits(uniQuote.amountOut, 18)} DAI (Fee: ${uniQuote.fee/10000}%)`);
    console.log(`   Sushiswap V2 DAI→USDC: ${ethers.formatUnits(outputSushi, 6)} USDC`);
    console.log(`   Gas Cost: ${gasCostEth} ETH (≈$${ethers.formatUnits(gasCostUsd, 6)})`);
    console.log(`   Potential Profit: ${profitUsd} USDC`);
    
    // Record gas metrics for monitoring
    await performanceMonitor.recordGasMetrics({
      gasPriceGwei: ethers.formatGwei(gasPrice.gasPrice),
      gasLimit: gasEst.toString(),
      estimatedCost: gasCostUsd,
      actualCost: null, // Will be updated after execution
      networkCongestion: gasPrice.gasPrice > ethers.parseGwei('50') ? 'high' : 'normal'
    });
    
    // Check if profit meets minimum threshold
    const meetsMinProfit = profit >= MIN_PROFIT_USD;
    const isProfitable = profit > 0 && meetsMinProfit;
    
    if (!meetsMinProfit && profit > 0) {
      console.log(`⚠️  Profit (${profitUsd} USDC) below minimum threshold (${ethers.formatUnits(MIN_PROFIT_USD, 6)} USDC)`);
    }
    
    return { 
      profitable: isProfitable, 
      profit, 
      gasCost: gasCostUsd, 
      reason: isProfitable ? 'Profitable' : (profit > 0 ? 'Below threshold' : 'Not profitable')
    };
  } catch (error) {
    console.error('❌ Error checking profitability:', error.message);
    return { profitable: false, profit: 0n, gasCost: 0n, reason: 'Error occurred' };
  } finally {
    const executionTime = Date.now() - startTime;
    console.log(`⏱️  Profitability check took ${executionTime}ms`);
  }
}

async function executeArbitrage() {
  const startTime = Date.now();
  let tx, receipt;
  
  try {
    console.log('🚀 Executing arbitrage on mainnet...');
    
    // Get current gas price for better estimation
    const gasPrice = await provider.getFeeData();
    console.log(`⛽ Current gas price: ${ethers.formatGwei(gasPrice.gasPrice)} gwei`);
    
    // Calculate minimum profit threshold (use the profit we calculated)
    const { profitable, profit } = await checkProfitability();
    const minProfit = profit * 95n / 100n; // 95% of calculated profit as safety margin
    
    tx = await contract.executeArbitrage(USDC, AMOUNT, minProfit, {
      gasLimit: 500000, // Set reasonable gas limit
      maxFeePerGas: gasPrice.maxFeePerGas || gasPrice.gasPrice,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei')
    });
    
    console.log(`📝 Transaction submitted: ${tx.hash}`);
    console.log(`🔗 View on BaseScan: https://basescan.org/tx/${tx.hash}`);
    
    receipt = await tx.wait();
    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`⏱️  Total execution time: ${executionTime}ms`);
    
    // Record successful trade for monitoring
    const tradeData = {
      txHash: tx.hash,
      tokenAddress: USDC,
      amount: ethers.formatUnits(AMOUNT, 6),
      profit: ethers.formatUnits(profit, 6),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: ethers.formatGwei(gasPrice.gasPrice),
      gasCost: ethers.formatEther(receipt.gasUsed * gasPrice.gasPrice),
      executionTime: executionTime,
      status: 'success',
      blockNumber: receipt.blockNumber,
      network: 'base-mainnet'
    };
    
    await performanceMonitor.recordTrade(tradeData);
    await alertSystem.onTradeSuccess(tradeData);
    
    return { success: true, tradeData };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Error executing arbitrage:', error.message);
    
    // Record failed trade for monitoring
    const tradeData = {
      txHash: tx?.hash || null,
      tokenAddress: USDC,
      amount: ethers.formatUnits(AMOUNT, 6),
      profit: '0',
      gasUsed: receipt?.gasUsed?.toString() || '0',
      gasPrice: gasPrice?.gasPrice ? ethers.formatGwei(gasPrice.gasPrice) : '0',
      gasCost: receipt?.gasUsed && gasPrice?.gasPrice ? 
        ethers.formatEther(receipt.gasUsed * gasPrice.gasPrice) : '0',
      executionTime: executionTime,
      status: 'failed',
      errorMessage: error.message,
      blockNumber: receipt?.blockNumber || null,
      network: 'base-mainnet'
    };
    
    await performanceMonitor.recordTrade(tradeData);
    await alertSystem.onTradeFailure(tradeData);
    
    // Provide helpful error messages
    if (error.message.includes('insufficient funds')) {
      console.log('💡 Tip: Ensure you have enough ETH for gas fees');
    } else if (error.message.includes('execution reverted')) {
      console.log('💡 Tip: Check if the contract is properly deployed and accessible');
    } else if (error.message.includes('Profit below minimum threshold')) {
      console.log('💡 Tip: The profit is below the minimum threshold set in the contract');
    }
    
    return { success: false, tradeData };
  }
}

async function checkWalletBalance() {
  try {
    const ethBalance = await provider.getBalance(wallet.address);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    
    console.log(`💰 Wallet Balance: ${ethBalanceFormatted} ETH`);
    
    if (ethBalance < ethers.parseEther('0.01')) {
      console.log('⚠️  Warning: Low ETH balance for gas fees');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error.message);
    return false;
  }
}

async function runHealthCheck() {
  try {
    console.log('🏥 Running health check...');
    
    // Check wallet balance
    const walletHealthy = await checkWalletBalance();
    
    // Check alert system
    const alerts = await alertSystem.checkAlerts();
    
    // Get current metrics
    const metrics = performanceMonitor.getCurrentMetrics();
    
    console.log('📊 Health Check Results:');
    console.log(`   Wallet: ${walletHealthy ? '✅ Healthy' : '❌ Issues'}`);
    console.log(`   Total Trades: ${metrics.totalTrades}`);
    console.log(`   Success Rate: ${metrics.successRate}%`);
    console.log(`   Consecutive Failures: ${metrics.consecutiveFailures}`);
    console.log(`   Uptime: ${Math.floor(metrics.uptimeMinutes / 60)}h ${metrics.uptimeMinutes % 60}m`);
    console.log(`   Active Alerts: ${alerts.length}`);
    
    if (alerts.length > 0) {
      console.log('🚨 Active Alerts:');
      alerts.forEach(alert => {
        console.log(`   - ${alert.severity.toUpperCase()}: ${alert.message}`);
      });
    }
    
    return { healthy: walletHealthy, alerts: alerts.length };
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return { healthy: false, alerts: 0 };
  }
}

async function main() {
  console.log('🔄 Starting enhanced mainnet arbitrage monitoring...\n');
  
  // Initial wallet check
  if (!(await checkWalletBalance())) {
    console.log('❌ Insufficient funds to continue');
    process.exit(1);
  }
  
  // Run initial health check
  await runHealthCheck();
  
  let iteration = 0;
  
  while (true) {
    try {
      iteration++;
      const timestamp = new Date().toISOString();
      console.log(`\n⏰ ${timestamp} - Iteration ${iteration}`);
      
      // Check if arbitrage is profitable
      const { profitable, profit, gasCost, reason } = await checkProfitability();
      
      if (profitable) {
        console.log('💰 Profitable arbitrage opportunity found!');
        
        // Double-check wallet balance before execution
        if (await checkWalletBalance()) {
          const result = await executeArbitrage();
          
          if (result.success) {
            console.log('🎉 Arbitrage executed successfully on mainnet!');
          } else {
            console.log('⚠️  Arbitrage execution failed');
          }
        } else {
          console.log('❌ Insufficient funds for execution');
        }
      } else {
        console.log(`😔 ${reason}`);
      }
      
      // Run health check every 10 iterations
      if (iteration % 10 === 0) {
        await runHealthCheck();
      }
      
      console.log(`⏳ Waiting ${CHECK_INTERVAL/1000} seconds before next check...\n`);
      await new Promise(r => setTimeout(r, CHECK_INTERVAL));
      
    } catch (error) {
      console.error('💥 Unexpected error:', error.message);
      console.log('⏳ Retrying in 30 seconds...\n');
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Enhanced CryptoBot...');
  
  // Final health check
  await runHealthCheck();
  
  // Export final metrics
  try {
    const finalMetrics = await performanceMonitor.exportMetrics('json');
    console.log('📊 Final metrics exported');
  } catch (error) {
    console.error('❌ Failed to export final metrics:', error.message);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Enhanced CryptoBot...');
  await runHealthCheck();
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
