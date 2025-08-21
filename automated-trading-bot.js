require('dotenv').config();
const { ethers } = require('ethers');

// Real Automated Trading Bot for Base Mainnet
class AutomatedTradingBot {
  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    this.wallet = new ethers.Wallet(process.env.WALLET_KEY, this.provider);
    
    // IMPORTANT: Use the contract address you actually funded!
    this.contractAddress = '0x3aeB8076fCcaa67B446E2ffB54113F0C4D999573';
    
    // Token addresses
    this.TOKENS = {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      WETH: '0x4200000000000000000000000000000000000006',
      DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'
    };
    
    // DEX Router addresses
    this.ROUTERS = {
      uniswapV3: '0x2626664C2603336e57b271C5c0B26f421741E8eE',
      sushiswapV2: '0x6e086AbE2ECB3f660b15Fb3a3ef0028BE6a4a1e0'
    };
    
    // Configuration
    this.TRADE_AMOUNT = ethers.parseUnits(process.env.TRADE_AMOUNT || '10', 6);
    this.MIN_PROFIT_USD = ethers.parseUnits(process.env.MIN_PROFIT || '0.5', 6);
    this.CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '10000'); // 10 seconds
    
    // Trading statistics
    this.stats = {
      totalChecks: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: 0n,
      totalGasCost: 0n
    };
    
    console.log('🤖 Automated Trading Bot Starting...');
    console.log(`💰 Trade Amount: ${ethers.formatUnits(this.TRADE_AMOUNT, 6)} USDC`);
    console.log(`💵 Min Profit: $${ethers.formatUnits(this.MIN_PROFIT_USD, 6)}`);
    console.log(`⏰ Check Interval: ${this.CHECK_INTERVAL/1000}s`);
    console.log(`👛 Wallet: ${this.wallet.address}`);
    console.log(`📋 Contract: ${this.contractAddress}`);
  }
  
  // Get real price from Uniswap V3
  async getUniswapV3Price(tokenIn, tokenOut, amountIn) {
    try {
      const quoter = new ethers.Contract(
        '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // Uniswap V3 Quoter
        ['function quoteExactInputSingle(address,address,uint24,uint256,uint160) view returns (uint256)'],
        this.provider
      );
      
      const amountOut = await quoter.quoteExactInputSingle(
        tokenIn, 
        tokenOut, 
        3000, // 0.3% fee tier
        amountIn, 
        0
      );
      
      return amountOut;
    } catch (error) {
      console.log(`⚠️ Uniswap V3 price fetch failed: ${error.message}`);
      return null;
    }
  }
  
  // Get real price from Sushiswap V2
  async getSushiswapV2Price(tokenIn, tokenOut, amountIn) {
    try {
      const router = new ethers.Contract(
        this.ROUTERS.sushiswapV2,
        ['function getAmountsOut(uint,address[]) view returns (uint[])'],
        this.provider
      );
      
      const path = [tokenIn, tokenOut];
      const amounts = await router.getAmountsOut(amountIn, path);
      
      return amounts[1];
    } catch (error) {
      console.log(`⚠️ Sushiswap V2 price fetch failed: ${error.message}`);
      return null;
    }
  }
  
  // Find real arbitrage opportunities
  async findRealArbitrageOpportunities() {
    console.log('🔍 Scanning for real arbitrage opportunities...');
    
    try {
      // Strategy 1: USDC -> WETH -> USDC arbitrage
      console.log('  📊 Testing USDC → WETH → USDC arbitrage...');
      
      // Step 1: USDC -> WETH on Uniswap V3
      const wethFromUniswap = await this.getUniswapV3Price(
        this.TOKENS.USDC, 
        this.TOKENS.WETH, 
        this.TRADE_AMOUNT
      );
      
      if (wethFromUniswap) {
        console.log(`    💱 Uniswap V3: ${ethers.formatUnits(this.TRADE_AMOUNT, 6)} USDC → ${ethers.formatUnits(wethFromUniswap, 18)} WETH`);
        
        // Step 2: WETH -> USDC on Sushiswap V2
        const usdcFromSushi = await this.getSushiswapV2Price(
          this.TOKENS.WETH,
          this.TOKENS.USDC,
          wethFromUniswap
        );
        
        if (usdcFromSushi) {
          console.log(`    💱 Sushiswap V2: ${ethers.formatUnits(wethFromUniswap, 18)} WETH → ${ethers.formatUnits(usdcFromSushi, 6)} USDC`);
          
          // FIXED: Proper profit calculation
          const profit = usdcFromSushi - this.TRADE_AMOUNT;
          const gasCost = ethers.parseUnits('0.5', 6); // $0.50 estimated gas cost
          const netProfit = profit - gasCost;
          
          console.log(`    💰 Gross Profit: ${ethers.formatUnits(profit, 6)} USDC`);
          console.log(`    ⛽ Gas Cost: ${ethers.formatUnits(gasCost, 6)} USDC`);
          console.log(`    💵 Net Profit: ${ethers.formatUnits(netProfit, 6)} USDC`);
          
          if (netProfit > this.MIN_PROFIT_USD && netProfit > 0) {
            console.log(`    ✅ PROFITABLE OPPORTUNITY FOUND!`);
            return {
              strategy: 'USDC → WETH → USDC',
              profit: netProfit,
              gasCost: gasCost,
              steps: [
                { dex: 'Uniswap V3', from: 'USDC', to: 'WETH', amountIn: this.TRADE_AMOUNT, amountOut: wethFromUniswap },
                { dex: 'Sushiswap V2', from: 'WETH', to: 'USDC', amountIn: wethFromUniswap, amountOut: usdcFromSushi }
              ]
            };
          } else {
            console.log(`    ❌ Not profitable: ${ethers.formatUnits(netProfit, 6)} USDC < ${ethers.formatUnits(this.MIN_PROFIT_USD, 6)} USDC`);
          }
        }
      }
      
      // Strategy 2: WETH -> USDC -> WETH arbitrage (reverse direction)
      console.log('  📊 Testing WETH → USDC → WETH arbitrage...');
      
      const wethAmount = ethers.parseEther('0.005'); // 0.005 WETH
      
      // Step 1: WETH -> USDC on Sushiswap V2
      const usdcFromSushi2 = await this.getSushiswapV2Price(
        this.TOKENS.WETH,
        this.TOKENS.USDC,
        wethAmount
      );
      
      if (usdcFromSushi2) {
        console.log(`    💱 Sushiswap V2: ${ethers.formatUnits(wethAmount, 18)} WETH → ${ethers.formatUnits(usdcFromSushi2, 6)} USDC`);
        
        // Step 2: USDC -> WETH on Uniswap V3
        const wethFromUniswap2 = await this.getUniswapV3Price(
          this.TOKENS.USDC,
          this.TOKENS.WETH,
          usdcFromSushi2
        );
        
        if (wethFromUniswap2) {
          console.log(`    💱 Uniswap V3: ${ethers.formatUnits(usdcFromSushi2, 6)} USDC → ${ethers.formatUnits(wethFromUniswap2, 18)} WETH`);
          
          // FIXED: Proper profit calculation
          const profitWeth = wethFromUniswap2 - wethAmount;
          const gasCostWeth = ethers.parseEther('0.0002'); // 0.0002 WETH gas cost
          const netProfitWeth = profitWeth - gasCostWeth;
          
          // Convert to USDC for comparison (assuming 1 WETH = $3000)
          const profitUsdc = (profitWeth * 3000n) / ethers.parseEther('1');
          
          console.log(`    💰 Gross Profit: ${ethers.formatUnits(profitWeth, 18)} WETH (~$${ethers.formatUnits(profitUsdc, 6)})`);
          console.log(`    ⛽ Gas Cost: ${ethers.formatUnits(gasCostWeth, 18)} WETH`);
          console.log(`    💵 Net Profit: ${ethers.formatUnits(netProfitWeth, 18)} WETH`);
          
          if (profitUsdc > this.MIN_PROFIT_USD && netProfitWeth > 0) {
            console.log(`    ✅ PROFITABLE OPPORTUNITY FOUND!`);
            return {
              strategy: 'WETH → USDC → WETH',
              profit: profitUsdc,
              gasCost: (gasCostWeth * 3000n) / ethers.parseEther('1'),
              steps: [
                { dex: 'Sushiswap V2', from: 'WETH', to: 'USDC', amountIn: wethAmount, amountOut: usdcFromSushi2 },
                { dex: 'Uniswap V3', from: 'USDC', to: 'WETH', amountIn: usdcFromSushi2, amountOut: wethFromUniswap2 }
              ]
            };
          } else {
            console.log(`    ❌ Not profitable: ${ethers.formatUnits(profitUsdc, 6)} USDC < ${ethers.formatUnits(this.MIN_PROFIT_USD, 6)} USDC`);
          }
        }
      }
      
    } catch (error) {
      console.error('💥 Error finding opportunities:', error.message);
    }
    
    return null;
  }
  
  // Execute real trade using the contract
  async executeRealTrade(opportunity) {
    try {
      console.log(`🚀 EXECUTING REAL TRADE: ${opportunity.strategy}`);
      console.log(`💰 Expected Profit: $${ethers.formatUnits(opportunity.profit, 6)}`);
      
      // Create contract instance
      const contract = new ethers.Contract(
        this.contractAddress,
        [
          'function executeArbitrage(address,uint256,uint256) external',
          'function minProfitThreshold() view returns (uint256)',
          'function owner() view returns (address)'
        ],
        this.wallet
      );
      
      // Check if you're the contract owner
      const owner = await contract.owner();
      if (owner !== this.wallet.address) {
        console.log(`❌ You are not the contract owner. Owner: ${owner}`);
        return false;
      }
      
      // Check contract's min profit threshold
      const contractMinProfit = await contract.minProfitThreshold();
      console.log(`📋 Contract minProfitThreshold: ${ethers.formatUnits(contractMinProfit, 6)} USDC`);
      
      if (opportunity.profit < contractMinProfit) {
        console.log(`❌ Profit ${ethers.formatUnits(opportunity.profit, 6)} USDC is below contract threshold ${ethers.formatUnits(contractMinProfit, 6)} USDC`);
        return false;
      }
      
      console.log(`✅ Profit meets contract requirements!`);
      
      // Execute the arbitrage through the contract
      console.log(`🎯 Executing arbitrage through contract...`);
      
      const tx = await contract.executeArbitrage(
        this.TOKENS.USDC, // token to trade
        this.TRADE_AMOUNT, // amount to trade
        opportunity.profit * 95n / 100n // min profit (5% slippage)
      );
      
      console.log(`📝 Transaction sent: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      
      this.stats.successfulTrades++;
      this.stats.totalProfit += opportunity.profit;
      
      console.log(`✅ Trade executed successfully!`);
      return true;
      
    } catch (error) {
      console.error(`❌ Trade execution failed: ${error.message}`);
      this.stats.failedTrades++;
      return false;
    }
  }
  
  // Main trading loop
  async start() {
    console.log('🚀 Starting automated trading bot...\n');
    
    while (true) {
      try {
        this.stats.totalChecks++;
        const timestamp = new Date().toISOString();
        
        console.log(`\n⏰ ${timestamp} - Check #${this.stats.totalChecks}`);
        
        const opportunity = await this.findRealArbitrageOpportunities();
        
        if (opportunity) {
          console.log(`\n💰 ARBITRAGE OPPORTUNITY DETECTED!`);
          console.log(`   Strategy: ${opportunity.strategy}`);
          console.log(`   Profit: $${ethers.formatUnits(opportunity.profit, 6)}`);
          console.log(`   Gas Cost: $${ethers.formatUnits(opportunity.gasCost, 6)}`);
          
          // Execute the trade
          await this.executeRealTrade(opportunity);
        } else {
          console.log('😔 No profitable opportunities found at current prices');
        }
        
        // Display statistics every 5 checks
        if (this.stats.totalChecks % 5 === 0) {
          this.displayStats();
        }
        
        console.log(`⏳ Waiting ${this.CHECK_INTERVAL/1000}s for next check...`);
        await new Promise(resolve => setTimeout(resolve, this.CHECK_INTERVAL));
        
      } catch (error) {
        console.error('💥 Error in trading loop:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  // Display trading statistics
  displayStats() {
    const successRate = this.stats.totalChecks > 0 ? 
      ((this.stats.successfulTrades / this.stats.totalChecks) * 100).toFixed(1) : '0.0';
    
    console.log('\n📊 Trading Statistics:');
    console.log(`   Total Checks: ${this.stats.totalChecks}`);
    console.log(`   Successful Trades: ${this.stats.successfulTrades}`);
    console.log(`   Failed Trades: ${this.stats.failedTrades}`);
    console.log(`   Success Rate: ${successRate}% of checks resulted in trades`);
    console.log(`   Total Profit: $${ethers.formatUnits(this.stats.totalProfit, 6)}`);
    console.log(`   Check Interval: ${this.CHECK_INTERVAL/1000}s`);
  }
}

// Start the automated trading bot
console.log('🤖 Initializing Automated Trading Bot...');
const bot = new AutomatedTradingBot();
bot.start().catch(console.error);
