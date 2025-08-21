require('dotenv').config();
const { ethers } = require('ethers');

// WORKING Base Mainnet Bot - REAL PRICE FETCHING
class WorkingBaseBot {
  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    this.wallet = new ethers.Wallet(process.env.WALLET_KEY, this.provider);
    this.contractAddress = '0x3aeB8076fCcaa67B446E2ffB54113F0C4D999573';
    
    // CORRECT token addresses for Base mainnet
    this.TOKENS = {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      WETH: '0x4200000000000000000000000000000000000006',
      DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
      cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22'
    };
    
    // Token decimals for proper formatting
    this.TOKEN_DECIMALS = {
      USDC: 6,
      WETH: 18,
      DAI: 18,
      USDbC: 6,
      cbETH: 18
    };
    
    // DEX configurations for Base mainnet
    this.DEXES = {
      uniswapV3: {
        name: 'Uniswap V3',
        quoterAddress: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
        routerAddress: '0x2626664c2603336E57B271c5C0b26F421741e481'
      },
      baseswap: {
        name: 'BaseSwap',
        routerAddress: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB'
      },
      aerodrome: {
        name: 'Aerodrome',
        routerAddress: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da'
      },
      sushiswapV2: {
        name: 'Sushiswap V2',
        routerAddress: '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891'
      },
      alienbase: {
        name: 'AlienBase',
        routerAddress: '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891' // Using Sushiswap V2 address as fallback
      }
    };
    
    // Configuration - REALISTIC for Base
    this.TRADE_AMOUNT = ethers.parseUnits(process.env.TRADE_AMOUNT || '25', 6);
    this.MIN_PROFIT_USD = ethers.parseUnits(process.env.MIN_PROFIT || '0.5', 6);
    this.CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '5000');
    
    // Performance tracking
    this.stats = {
      totalChecks: 0,
      successfulFetches: 0,
      failedFetches: 0,
      opportunitiesFound: 0
    };
    
    console.log('🚀 WORKING Base Mainnet Bot Starting...');
    console.log(`💰 Trade Amount: ${ethers.formatUnits(this.TRADE_AMOUNT, 6)} USDC`);
    console.log(`💵 Min Profit: $${ethers.formatUnits(this.MIN_PROFIT_USD, 6)}`);
    console.log(`🔗 Contract: ${this.contractAddress}`);
    console.log(`🌐 Network: Base Mainnet`);
    console.log(`🎯 Using REAL price fetching from DEXes...`);
  }
  
  // Check network connectivity
  async checkNetworkConnectivity() {
    try {
      console.log('🌐 Checking network connectivity...');
      
      // Check if we can get the latest block
      const latestBlock = await this.provider.getBlockNumber();
      console.log(`   ✅ Latest block: ${latestBlock}`);
      
      // Check if we can get gas price
      const gasPrice = await this.provider.getFeeData();
      console.log(`   ✅ Gas price: ${ethers.formatGwei(gasPrice.gasPrice)} gwei`);
      
      // Check wallet balance
      const balance = await this.wallet.getBalance();
      console.log(`   ✅ Wallet balance: ${ethers.formatEther(balance)} ETH`);
      
      return true;
    } catch (error) {
      console.error(`   ❌ Network connectivity failed: ${error.message}`);
      return false;
    }
  }
  
  // Real price fetching from Uniswap V3
  async getUniswapV3Price(tokenIn, tokenOut, amountIn) {
    try {
      const quoterAddress = this.DEXES.uniswapV3.quoterAddress;
      const quoterABI = [
        'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)'
      ];
      
      const quoter = new ethers.Contract(quoterAddress, quoterABI, this.provider);
      
      // Try different fee tiers
      const fees = [500, 3000, 10000];
      
      for (const fee of fees) {
        try {
          const amountOut = await quoter.quoteExactInputSingle(
            tokenIn, tokenOut, fee, amountIn, 0
          );
          return { amountOut, fee, dex: 'Uniswap V3' };
        } catch (e) {
          if (e.code === 'CALL_EXCEPTION') {
            // This usually means no liquidity pool exists for this fee tier
            continue;
          } else {
            console.log(`         ⚠️  Uniswap V3 fee ${fee/10000}% error: ${e.message}`);
            continue;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.log(`         ❌ Uniswap V3 general error: ${error.message}`);
      return null;
    }
  }
  
  // Real price fetching from Sushiswap V2
  async getSushiswapV2Price(tokenIn, tokenOut, amountIn) {
    try {
      const routerAddress = this.DEXES.sushiswapV2.routerAddress;
      const routerABI = [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
      ];
      
      const router = new ethers.Contract(routerAddress, routerABI, this.provider);
      const path = [tokenIn, tokenOut];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      return { amountOut: amounts[1], fee: 3000, dex: 'Sushiswap V2' };
    } catch (error) {
      if (error.code === 'CALL_EXCEPTION') {
        console.log(`         ❌ Sushiswap V2: No liquidity pool found`);
      } else {
        console.log(`         ❌ Sushiswap V2 error: ${error.message}`);
      }
      return null;
    }
  }
  
  // Real price fetching from BaseSwap
  async getBaseSwapPrice(tokenIn, tokenOut, amountIn) {
    try {
      const routerAddress = this.DEXES.baseswap.routerAddress;
      const routerABI = [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
      ];
      
      const router = new ethers.Contract(routerAddress, routerABI, this.provider);
      const path = [tokenIn, tokenOut];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      return { amountOut: amounts[1], fee: 3000, dex: 'BaseSwap' };
    } catch (error) {
      if (error.code === 'CALL_EXCEPTION') {
        console.log(`         ❌ BaseSwap: No liquidity pool found`);
      } else {
        console.log(`         ❌ BaseSwap error: ${error.message}`);
      }
      return null;
    }
  }
  
  // Real price fetching from Aerodrome
  async getAerodromePrice(tokenIn, tokenOut, amountIn) {
    try {
      const routerAddress = this.DEXES.aerodrome.routerAddress;
      const routerABI = [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
      ];
      
      const router = new ethers.Contract(routerAddress, routerABI, this.provider);
      const path = [tokenIn, tokenOut];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      return { amountOut: amounts[1], fee: 3000, dex: 'Aerodrome' };
    } catch (error) {
      if (error.code === 'CALL_EXCEPTION') {
        console.log(`         ❌ Aerodrome: No liquidity pool found`);
      } else {
        console.log(`         ❌ Aerodrome error: ${error.message}`);
      }
      return null;
    }
  }
  
  // Get all DEX prices for a token pair
  async getAllDexPrices(tokenIn, tokenOut, amountIn) {
    const allPrices = [];
    
    console.log(`       🔍 Fetching prices for ${ethers.formatUnits(amountIn, 6)} USDC...`);
    
    // Try Uniswap V3
    const uniPrice = await this.getUniswapV3Price(tokenIn, tokenOut, amountIn);
    if (uniPrice) {
      allPrices.push(uniPrice);
      console.log(`         ✅ Uniswap V3: ${ethers.formatUnits(uniPrice.amountOut, 18)} (fee: ${uniPrice.fee/10000}%)`);
    } else {
      console.log(`         ❌ Uniswap V3: No price available`);
    }
    
    // Try Sushiswap V2
    const sushiPrice = await this.getSushiswapV2Price(tokenIn, tokenOut, amountIn);
    if (sushiPrice) {
      allPrices.push(sushiPrice);
      console.log(`         ✅ Sushiswap V2: ${ethers.formatUnits(sushiPrice.amountOut, 18)}`);
    } else {
      console.log(`         ❌ Sushiswap V2: No price available`);
    }
    
    // Try BaseSwap
    const basePrice = await this.getBaseSwapPrice(tokenIn, tokenOut, amountIn);
    if (basePrice) {
      allPrices.push(basePrice);
      console.log(`         ✅ BaseSwap: ${ethers.formatUnits(basePrice.amountOut, 18)}`);
    } else {
      console.log(`         ❌ BaseSwap: No price available`);
    }
    
    // Try Aerodrome
    const aeroPrice = await this.getAerodromePrice(tokenIn, tokenOut, amountIn);
    if (aeroPrice) {
      allPrices.push(aeroPrice);
      console.log(`         ✅ Aerodrome: ${ethers.formatUnits(aeroPrice.amountOut, 18)}`);
    } else {
      console.log(`         ❌ Aerodrome: No price available`);
    }
    
    console.log(`       📊 Total DEX prices found: ${allPrices.length}`);
    return allPrices;
  }
  
  // Helper function to get token symbol from address
  getTokenSymbol(address) {
    for (const [symbol, addr] of Object.entries(this.TOKENS)) {
      if (addr.toLowerCase() === address.toLowerCase()) {
        return symbol;
      }
    }
    return 'UNKNOWN';
  }
  
  // Helper function to get token decimals
  getTokenDecimals(address) {
    const symbol = this.getTokenSymbol(address);
    return this.TOKEN_DECIMALS[symbol] || 18;
  }
  
  // Find real arbitrage opportunities
  async findArbitrageOpportunities() {
    console.log('🔍 Checking ALL token pairs across ALL DEXes...');
    
    const opportunities = [];
    
    // Check USDC/DAI pair
    console.log('  📊 Checking USDC/DAI...');
    const usdcDaiPrices = await this.getAllDexPrices(this.TOKENS.USDC, this.TOKENS.DAI, this.TRADE_AMOUNT);
    console.log(`     Found ${usdcDaiPrices.length} DEX prices for USDC/DAI`);
    
    if (usdcDaiPrices.length >= 2) {
      // Find best buy (highest amount out) and best sell (lowest amount out)
      const bestBuy = usdcDaiPrices.reduce((best, current) => 
        current.amountOut > best.amountOut ? current : best
      );
      const bestSell = usdcDaiPrices.reduce((best, current) => 
        current.amountOut < best.amountOut ? current : best
      );
      
      console.log(`     Best Buy: ${bestBuy.dex} - ${ethers.formatUnits(bestBuy.amountOut, 18)} DAI`);
      console.log(`     Best Sell: ${bestSell.dex} - ${ethers.formatUnits(bestSell.amountOut, 18)} DAI`);
      
      // Calculate potential profit (buy low, sell high)
      if (bestBuy.amountOut > bestSell.amountOut) {
        const profit = bestBuy.amountOut - bestSell.amountOut;
        console.log(`     Potential profit: ${ethers.formatUnits(profit, 18)} DAI`);
        
        if (profit > this.MIN_PROFIT_USD) {
          opportunities.push({
            strategy: 'USDC-DAI Arbitrage',
            profit: profit,
            buyDex: bestBuy.dex,
            sellDex: bestSell.dex,
            buyAmount: bestBuy.amountOut,
            sellAmount: bestSell.amountOut,
            path: 'USDC ↔ DAI',
            tokenInDecimals: 6,
            tokenOutDecimals: 18
          });
          console.log(`     ✅ USDC-DAI opportunity found!`);
        } else {
          console.log(`     ❌ Profit ${ethers.formatUnits(profit, 18)} DAI below minimum threshold ${ethers.formatUnits(this.MIN_PROFIT_USD, 18)}`);
        }
      } else {
        console.log(`     ❌ No price difference (best buy <= best sell)`);
      }
    } else {
      console.log(`     ❌ Need at least 2 DEX prices, found ${usdcDaiPrices.length}`);
    }
    
    // Check USDC/WETH pair
    console.log('  📊 Checking USDC/WETH...');
    const usdcWethPrices = await this.getAllDexPrices(this.TOKENS.USDC, this.TOKENS.WETH, this.TRADE_AMOUNT);
    console.log(`     Found ${usdcWethPrices.length} DEX prices for USDC/WETH`);
    
    if (usdcWethPrices.length >= 2) {
      const bestBuy = usdcWethPrices.reduce((best, current) => 
        current.amountOut > best.amountOut ? current : best
      );
      const bestSell = usdcWethPrices.reduce((best, current) => 
        current.amountOut < best.amountOut ? current : best
      );
      
      console.log(`     Best Buy: ${bestBuy.dex} - ${ethers.formatUnits(bestBuy.amountOut, 18)} WETH`);
      console.log(`     Best Sell: ${bestSell.dex} - ${ethers.formatUnits(bestSell.amountOut, 18)} WETH`);
      
      if (bestBuy.amountOut > bestSell.amountOut) {
        const profit = bestBuy.amountOut - bestSell.amountOut;
        console.log(`     Potential profit: ${ethers.formatUnits(profit, 18)} WETH`);
        
        if (profit > this.MIN_PROFIT_USD) {
          opportunities.push({
            strategy: 'USDC-WETH Arbitrage',
            profit: profit,
            buyDex: bestBuy.dex,
            sellDex: bestSell.dex,
            buyAmount: bestBuy.amountOut,
            sellAmount: bestSell.amountOut,
            path: 'USDC ↔ WETH',
            tokenInDecimals: 6,
            tokenOutDecimals: 18
          });
          console.log(`     ✅ USDC-WETH opportunity found!`);
        } else {
          console.log(`     ❌ Profit ${ethers.formatUnits(profit, 18)} WETH below minimum threshold ${ethers.formatUnits(this.MIN_PROFIT_USD, 18)}`);
        }
      } else {
        console.log(`     ❌ No price difference (best buy <= best sell)`);
      }
    } else {
      console.log(`     ❌ Need at least 2 DEX prices, found ${usdcWethPrices.length}`);
    }
    
    // Check DAI/WETH pair
    console.log('  📊 Checking DAI/WETH...');
    const daiWethPrices = await this.getAllDexPrices(this.TOKENS.DAI, this.TOKENS.WETH, this.TRADE_AMOUNT);
    console.log(`     Found ${daiWethPrices.length} DEX prices for DAI/WETH`);
    
    if (daiWethPrices.length >= 2) {
      const bestBuy = daiWethPrices.reduce((best, current) => 
        current.amountOut > best.amountOut ? current : best
      );
      const bestSell = daiWethPrices.reduce((best, current) => 
        current.amountOut < best.amountOut ? current : best
      );
      
      console.log(`     Best Buy: ${bestBuy.dex} - ${ethers.formatUnits(bestBuy.amountOut, 18)} WETH`);
      console.log(`     Best Sell: ${bestSell.dex} - ${ethers.formatUnits(bestSell.amountOut, 18)} WETH`);
      
      if (bestBuy.amountOut > bestSell.amountOut) {
        const profit = bestBuy.amountOut - bestSell.amountOut;
        console.log(`     Potential profit: ${ethers.formatUnits(profit, 18)} WETH`);
        
        if (profit > this.MIN_PROFIT_USD) {
          opportunities.push({
            strategy: 'DAI-WETH Arbitrage',
            profit: profit,
            buyDex: bestBuy.dex,
            sellDex: bestSell.dex,
            buyAmount: bestBuy.amountOut,
            sellAmount: bestSell.amountOut,
            path: 'DAI ↔ WETH',
            tokenInDecimals: 18,
            tokenOutDecimals: 18
          });
          console.log(`     ✅ DAI-WETH opportunity found!`);
        } else {
          console.log(`     ❌ Profit ${ethers.formatUnits(profit, 18)} WETH below minimum threshold ${ethers.formatUnits(this.MIN_PROFIT_USD, 18)}`);
        }
      } else {
        console.log(`     ❌ No price difference (best buy <= best sell)`);
      }
    } else {
      console.log(`     ❌ Need at least 2 DEX prices, found ${daiWethPrices.length}`);
    }
    
    // Check USDC/cbETH pair
    console.log('  📊 Checking USDC/cbETH...');
    const usdcCbEthPrices = await this.getAllDexPrices(this.TOKENS.USDC, this.TOKENS.cbETH, this.TRADE_AMOUNT);
    console.log(`     Found ${usdcCbEthPrices.length} DEX prices for USDC/cbETH`);
    
    if (usdcCbEthPrices.length >= 2) {
      const bestBuy = usdcCbEthPrices.reduce((best, current) => 
        current.amountOut > best.amountOut ? current : best
      );
      const bestSell = usdcCbEthPrices.reduce((best, current) => 
        current.amountOut < best.amountOut ? current : best
      );
      
      console.log(`     Best Buy: ${bestBuy.dex} - ${ethers.formatUnits(bestBuy.amountOut, 18)} cbETH`);
      console.log(`     Best Sell: ${bestSell.dex} - ${ethers.formatUnits(bestSell.amountOut, 18)} cbETH`);
      
      if (bestBuy.amountOut > bestSell.amountOut) {
        const profit = bestBuy.amountOut - bestSell.amountOut;
        console.log(`     Potential profit: ${ethers.formatUnits(profit, 18)} cbETH`);
        
        if (profit > this.MIN_PROFIT_USD) {
          opportunities.push({
            strategy: 'USDC-cbETH Arbitrage',
            profit: profit,
            buyDex: bestBuy.dex,
            sellDex: bestSell.dex,
            buyAmount: bestBuy.amountOut,
            sellAmount: bestSell.amountOut,
            path: 'USDC ↔ cbETH',
            tokenInDecimals: 6,
            tokenOutDecimals: 18
          });
          console.log(`     ✅ USDC-cbETH opportunity found!`);
        } else {
          console.log(`     ❌ Profit ${ethers.formatUnits(profit, 18)} cbETH below minimum threshold ${ethers.formatUnits(this.MIN_PROFIT_USD, 18)}`);
        }
      } else {
        console.log(`     ❌ No price difference (best buy <= best sell)`);
      }
    } else {
      console.log(`     ❌ Need at least 2 DEX prices, found ${usdcCbEthPrices.length}`);
    }
    
    // Check WETH/cbETH pair
    console.log('  📊 Checking WETH/cbETH...');
    const wethCbEthPrices = await this.getAllDexPrices(this.TOKENS.WETH, this.TOKENS.cbETH, this.TRADE_AMOUNT);
    console.log(`     Found ${wethCbEthPrices.length} DEX prices for WETH/cbETH`);
    
    if (wethCbEthPrices.length >= 2) {
      const bestBuy = wethCbEthPrices.reduce((best, current) => 
        current.amountOut > best.amountOut ? current : best
      );
      const bestSell = wethCbEthPrices.reduce((best, current) => 
        current.amountOut < best.amountOut ? current : best
      );
      
      console.log(`     Best Buy: ${bestBuy.dex} - ${ethers.formatUnits(bestBuy.amountOut, 18)} cbETH`);
      console.log(`     Best Sell: ${bestSell.dex} - ${ethers.formatUnits(bestSell.amountOut, 18)} cbETH`);
      
      if (bestBuy.amountOut > bestSell.amountOut) {
        const profit = bestBuy.amountOut - bestSell.amountOut;
        console.log(`     Potential profit: ${ethers.formatUnits(profit, 18)} cbETH`);
        
        if (profit > this.MIN_PROFIT_USD) {
          opportunities.push({
            strategy: 'WETH-cbETH Arbitrage',
            profit: profit,
            buyDex: bestBuy.dex,
            sellDex: bestSell.dex,
            buyAmount: bestBuy.amountOut,
            sellAmount: bestSell.amountOut,
            path: 'WETH ↔ cbETH',
            tokenInDecimals: 18,
            tokenOutDecimals: 18
          });
          console.log(`     ✅ WETH-cbETH opportunity found!`);
        } else {
          console.log(`     ❌ Profit ${ethers.formatUnits(profit, 18)} cbETH below minimum threshold ${ethers.formatUnits(this.MIN_PROFIT_USD, 18)}`);
        }
      } else {
        console.log(`     ❌ No price difference (best buy <= best sell)`);
      }
    } else {
      console.log(`     ❌ Need at least 2 DEX prices, found ${wethCbEthPrices.length}`);
    }
    
    // Return the best opportunity
    if (opportunities.length > 0) {
      const bestOpportunity = opportunities.reduce((best, current) => 
        current.profit > best.profit ? current : best
      );
      this.stats.successfulFetches++;
      console.log(`🎯 Found ${opportunities.length} total opportunities, best: ${ethers.formatUnits(bestOpportunity.profit, bestOpportunity.tokenOutDecimals)}`);
      return bestOpportunity;
    }
    
    this.stats.failedFetches++;
    console.log(`😔 No profitable opportunities found across all token pairs`);
    return null;
  }
  
  // Execute arbitrage
  async executeArbitrage(opportunity) {
    try {
      console.log(`🚀 Executing ${opportunity.strategy}...`);
      console.log(`   Buy from: ${opportunity.buyDex}`);
      console.log(`   Sell to: ${opportunity.sellDex}`);
      console.log(`   Buy Amount: ${ethers.formatUnits(opportunity.buyAmount, opportunity.tokenOutDecimals)}`);
      console.log(`   Sell Amount: ${ethers.formatUnits(opportunity.sellAmount, opportunity.tokenOutDecimals)}`);
      console.log(`   Profit: ${ethers.formatUnits(opportunity.profit, opportunity.tokenOutDecimals)}`);
      
      // SIMULATION MODE - Don't actually execute, just show the opportunity
      console.log(`🎯 SIMULATION MODE: Would execute ${opportunity.strategy}`);
      console.log(`   Expected Profit: ${ethers.formatUnits(opportunity.profit, opportunity.tokenOutDecimals)}`);
      
      // Mark as successful for statistics
      this.stats.opportunitiesFound++;
      
      return true;
      
    } catch (error) {
      console.error(`❌ Execution failed: ${error.message}`);
      return false;
    }
  }
  
  // Main monitoring loop
  async start() {
    console.log('🔄 Starting REAL arbitrage monitoring...\n');
    
    // First check network connectivity
    const isConnected = await this.checkNetworkConnectivity();
    if (!isConnected) {
      console.error('❌ Cannot connect to Base network. Please check your internet connection and RPC endpoint.');
      return;
    }
    
    console.log('✅ Network connectivity confirmed. Starting arbitrage monitoring...\n');
    
    while (true) {
      try {
        this.stats.totalChecks++;
        const timestamp = new Date().toISOString();
        
        console.log(`\n⏰ ${timestamp} - Iteration ${this.stats.totalChecks}`);
        
        const opportunity = await this.findArbitrageOpportunities();
        
        if (opportunity && opportunity.profit >= this.MIN_PROFIT_USD) {
          console.log(`💰 OPPORTUNITY FOUND!`);
          console.log(`   Strategy: ${opportunity.strategy}`);
          console.log(`   Profit: ${ethers.formatUnits(opportunity.profit, opportunity.tokenOutDecimals)}`);
          console.log(`   Buy DEX: ${opportunity.buyDex}`);
          console.log(`   Sell DEX: ${opportunity.sellDex}`);
          
          await this.executeArbitrage(opportunity);
        } else {
          console.log('No profitable arbitrage opportunities found at current prices');
        }
        
        if (this.stats.totalChecks % 3 === 0) {
          this.displayStats();
        }
        
        console.log('Waiting 5 seconds before next check...');
        await new Promise(resolve => setTimeout(resolve, this.CHECK_INTERVAL));
        
      } catch (error) {
        console.error('💥 Error in main loop:', error.message);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  
  // Display performance statistics
  displayStats() {
    const successRate = this.stats.totalChecks > 0 ? 
      ((this.stats.successfulFetches / (this.stats.successfulFetches + this.stats.failedFetches)) * 100).toFixed(1) : '0.0';
    
    console.log('\n📊 Performance Summary:');
    console.log(`   Total Checks: ${this.stats.totalChecks}`);
    console.log(`   Successful Fetches: ${this.stats.successfulFetches}`);
    console.log(`   Failed Fetches: ${this.stats.failedFetches}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Opportunities Found: ${this.stats.opportunitiesFound}`);
    console.log(`   Check Interval: ${this.CHECK_INTERVAL/1000}s`);
    console.log(`   Trade Amount: ${ethers.formatUnits(this.TRADE_AMOUNT, 6)} USDC`);
  }
}

// Start the working bot
const bot = new WorkingBaseBot();
bot.start().catch(console.error);
