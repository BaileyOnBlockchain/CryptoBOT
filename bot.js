require('dotenv').config();
const { ethers } = require('ethers');

// Check if environment variables are set
if (!process.env.WALLET_KEY) {
  console.error('❌ WALLET_KEY not found in environment variables');
  console.log('Please create a .env file with your private key');
  process.exit(1);
}

if (!process.env.CONTRACT_ADDRESS) {
  console.error('❌ CONTRACT_ADDRESS not found in environment variables');
  console.log('Please create a .env file with your contract address');
  process.exit(1);
}

// Network configuration (Base or Arbitrum)
const NETWORK = (process.env.NETWORK || 'base').toLowerCase();
const NETWORKS = {
  base: {
    name: 'Base Mainnet',
    chainId: 8453n,
    rpcUrl: 'https://mainnet.base.org',
    tokens: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      USDBC: null,
      DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      WETH: '0x4200000000000000000000000000000000000006',
      cbETH: '0x2Ae3f1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
      USDT: null,
      WBTC: null,
      WSTETH: null,
      AERO: '0x940181A94A5B84E0EEa4528f7342D0F0fA2A72d2'
    },
    dexes: {
      UNISWAP_V3: {
        name: 'Uniswap V3', type: 'v3',
        quoterAddress: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
        routerAddress: '0x2626664c2603336E57B271c5C0b26F421741e481',
        fees: [500, 3000, 10000]
      },
      BASESWAP: {
        name: 'BaseSwap', type: 'v2',
        routerAddress: '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB',
        fees: [3000]
      },
      AERODROME: {
        name: 'Aerodrome', type: 'solidly',
        routerAddress: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
        fees: []
      },
      SUSHISWAP_V2: {
        name: 'Sushiswap V2', type: 'v2',
        routerAddress: '0x6e086AbE2ECB3f660b15Fb3a3ef0028BE6a4a1e0',
        fees: [3000]
      }
    }
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161n,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    tokens: {
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // native USDC
      USDBC: null,
      DAI: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
      WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      cbETH: null,
      USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
      WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      WSTETH: '0x5979D7b546E38E414F7E9822514be443A4800529',
      AERO: null
    },
    dexes: {
      UNISWAP_V3: {
        name: 'Uniswap V3', type: 'v3',
        quoterAddress: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        fees: [500, 3000, 10000]
      },
      SUSHISWAP_V2: {
        name: 'Sushiswap V2', type: 'v2',
        routerAddress: '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506',
        fees: [3000]
      },
      CAMELOT_V2: {
        name: 'Camelot V2', type: 'v2',
        routerAddress: '0xC873fEcbd354f5A56E00E710B90EF4201db2448d',
        fees: [3000]
      }
    }
  }
};

const CURRENT = NETWORKS[NETWORK] || NETWORKS.base;
const provider = new ethers.JsonRpcProvider(CURRENT.rpcUrl);
const wallet = new ethers.Wallet(process.env.WALLET_KEY, provider);
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// Network verification function
async function verifyNetwork() {
  try {
    console.log('🔍 Verifying network connection...');
    
    // Check if we're on Base mainnet
    const network = await provider.getNetwork();
    if (network.chainId !== 8453n) { // Base mainnet chain ID
      console.log(`❌ Wrong network! Expected Base mainnet (8453), got ${network.chainId}`);
      return false;
    }
    
    // Check if provider is responsive
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected to Base mainnet (Block: ${blockNumber})`);
    
    // Check wallet connection
    const balance = await provider.getBalance(wallet.address);
    console.log(`✅ Wallet connected (Balance: ${ethers.formatEther(balance)} ETH)`);
    
    return true;
  } catch (error) {
    console.error('❌ Network verification failed:', error.message);
    return false;
  }
}

// Enhanced ABI for mainnet functionality
const abi = [
  'function executeArbitrage(address token, uint256 amount, uint256 minProfit) external',
  'function requestFlashLoan(address _token, uint256 _amount) public',
  'function owner() view returns (address)',
  'function minProfitThreshold() view returns (uint256)',
  'function maxSlippage() view returns (uint256)',
  'event ArbitrageExecuted(address indexed token, uint256 amount, uint256 profit, uint256 gasUsed, uint256 timestamp)',
  'event FlashLoanRequested(address indexed token, uint256 amount, uint256 timestamp)'
];

// Contract interface
const contract = new ethers.Contract(CONTRACT_ADDRESS, [
  'function executeArbitrage(address token, uint256 amount, uint256 minProfit) external returns (bool)',
  'function getContractBalance() external view returns (uint256)',
  'function emergencyWithdraw() external',
  'function pause() external',
  'function unpause() external'
], wallet);

// Token addresses from network config
const USDC = CURRENT.tokens.USDC;
const USDBC = CURRENT.tokens.USDBC;
const DAI = CURRENT.tokens.DAI;
const WETH = CURRENT.tokens.WETH;
const CBETH = CURRENT.tokens.cbETH;
const USDT = CURRENT.tokens.USDT;
const WBTC = CURRENT.tokens.WBTC;
const WSTETH = CURRENT.tokens.WSTETH;
const AERO = CURRENT.tokens.AERO;

// Additional Base mainnet DEXes for maximum reach
const DEXES = {
  ...CURRENT.dexes,
  ...(process.env.CURVE_ROUTER ? { CURVE: { name: 'Curve', type: 'curve', routerAddress: process.env.CURVE_ROUTER, fees: [] } } : {}),
  ...(process.env.BALANCER_VAULT ? { BALANCER: { name: 'Balancer', type: 'balancer', routerAddress: process.env.BALANCER_VAULT, fees: [] } } : {})
};

// Extended token pairs for maximum arbitrage opportunities
const TOKEN_PAIRS = [
  { tokenA: USDC, tokenB: DAI, name: 'USDC/DAI' },
  { tokenA: USDC, tokenB: WETH, name: 'USDC/WETH' },
  { tokenA: DAI, tokenB: WETH, name: 'DAI/WETH' },
  { tokenA: USDC, tokenB: CBETH, name: 'USDC/cbETH' },
  { tokenA: DAI, tokenB: CBETH, name: 'DAI/cbETH' },
  { tokenA: WETH, tokenB: CBETH, name: 'WETH/cbETH' },
  { tokenA: USDC, tokenB: USDT, name: 'USDC/USDT' },
  { tokenA: DAI, tokenB: USDT, name: 'DAI/USDT' },
  { tokenA: USDC, tokenB: WBTC, name: 'USDC/WBTC' },
  { tokenA: DAI, tokenB: WBTC, name: 'DAI/WBTC' },
  { tokenA: USDC, tokenB: WSTETH, name: 'USDC/wstETH' },
  { tokenA: DAI, tokenB: WSTETH, name: 'DAI/wstETH' },
  { tokenA: WETH, tokenB: WSTETH, name: 'WETH/wstETH' },
  { tokenA: USDC, tokenB: AERO, name: 'USDC/AERO' }
].filter(p => p.tokenA && p.tokenB);

// Configurable parameters - OPTIMIZED FOR SPEED
const AMOUNT = ethers.parseUnits(process.env.TRADE_AMOUNT || '10', 6); // base amount (6-dec default)
const MIN_PROFIT_INPUT = process.env.MIN_PROFIT || '0.5';
const MIN_PROFIT_USD = ethers.parseUnits(MIN_PROFIT_INPUT, 6); // Minimum profit in USDC (default scale)
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '5000'); // 5 seconds
const MAX_RETRIES = 3; // Maximum retry attempts
const PARALLEL_FETCHING = true; // Enable parallel price fetching
const SCAN_ONLY = (process.env.SCAN_ONLY || '1') === '1';
const MAX_PARALLEL = parseInt(process.env.MAX_PARALLEL || '5');
const QUOTE_TIMEOUT_MS = parseInt(process.env.QUOTE_TIMEOUT_MS || '1500');

console.log('🤖 CryptoBot Starting on Base Mainnet...');
console.log(`📍 Network: Base Mainnet`);
console.log(`👛 Wallet: ${wallet.address}`);
console.log(`📋 Contract: ${CONTRACT_ADDRESS}`);
console.log(`💰 Trade Amount: ${ethers.formatUnits(AMOUNT, 6)} USDC`);
console.log(`💵 Min Profit: $${ethers.formatUnits(MIN_PROFIT_USD, 6)}`);
console.log(`⏱️  Check Interval: ${CHECK_INTERVAL/1000} seconds`);

// Enhanced retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

function decimalsOf(token) {
  if (!token) return 18;
  const t = token.toLowerCase();
  if (USDC && t === USDC.toLowerCase()) return 6;
  if (USDBC && USDBC.toLowerCase && t === USDBC.toLowerCase()) return 6;
  return 18; // default
}

// Known Uniswap V3 Quoter addresses (try both)
const UNISWAP_V3_QUOTERS = [
  // Quoter V2 (common across many chains)
  '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  // Alternate/legacy on Base that some guides reference
  '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a'
];

// Uniswap V3 Factory (canonical address used across chains)
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const UNISWAP_V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
];

async function uniswapV3PoolExists(tokenA, tokenB, fee) {
  try {
    const factory = new ethers.Contract(UNISWAP_V3_FACTORY, UNISWAP_V3_FACTORY_ABI, provider);
    const pool = await factory.getPool(tokenA, tokenB, fee);
    return pool && pool !== ethers.ZeroAddress;
  } catch {
    return true; // if factory lookup fails, allow quote attempt
  }
}

// Get ETH price in USDC using Uniswap V3 Quoter (WETH -> USDC)
async function getEthPriceInUSDC() {
  try {
    const oneEth = ethers.parseUnits('1', 18);
    for (const addr of UNISWAP_V3_QUOTERS) {
      try {
        const quoter = new ethers.Contract(addr, [
          'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)'
        ], provider);
        for (const fee of [500, 3000, 10000]) {
          try {
            const amountOut = await quoter.quoteExactInputSingle(WETH, USDC, fee, oneEth, 0);
            if (amountOut && amountOut > 0n) return amountOut;
          } catch {}
        }
      } catch {}
    }
    throw new Error('All Uniswap quoters failed');
  } catch (e) {
    // Fallback to static price if quoter fails
    // 2000 USDC per ETH
    return ethers.parseUnits('2000', 6);
  }
}

// Enhanced price fetching with real DEX integration and retry logic
async function getUniswapV3Price(tokenIn, tokenOut, amountIn) {
  return retryWithBackoff(async () => {
    try {
      console.log(`🔍 Attempting Uniswap V3 price fetch...`);
      console.log(`   Token In: ${tokenIn} (USDC)`);
      console.log(`   Token Out: ${tokenOut} (DAI)`);
      console.log(`   Amount In: ${ethers.formatUnits(amountIn, 6)} USDC`);
      
      // Base mainnet Uniswap V3 Quoter - verified address
      const quoterAddress = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';
      console.log(`   Quoter Address: ${quoterAddress}`);
      
      const quoterABI = [
        'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)'
      ];
      
      const quoter = new ethers.Contract(quoterAddress, quoterABI, provider);
      
      // Try different fee tiers (0.05%, 0.3%, 1%) - Base mainnet common fees
      const fees = [500, 3000, 10000];
      
      for (const fee of fees) {
        try {
          console.log(`🔍 Trying Uniswap V3 fee tier: ${fee/10000}%`);
          const amountOut = await quoter.quoteExactInputSingle(
            tokenIn, tokenOut, fee, amountIn, 0
          );
          console.log(`✅ Uniswap V3 quote successful: ${ethers.formatUnits(amountOut, 18)} DAI (fee: ${fee/10000}%)`);
          return { amountOut, fee };
        } catch (e) {
          console.log(`⚠️  Fee tier ${fee/10000}% failed: ${e.message}`);
          if (e.code === 'CALL_EXCEPTION') {
            console.log(`   This usually means no liquidity pool exists for this fee tier`);
          }
          continue; // Try next fee tier
        }
      }
      
      // If direct USDC->DAI fails, try USDC->WETH->DAI path
      console.log(`🔍 Trying USDC->WETH->DAI path...`);
      try {
        // First get USDC->WETH quote
        const usdcToWeth = await quoter.quoteExactInputSingle(
          USDC, WETH, 3000, amountIn, 0
        );
        console.log(`   USDC->WETH: ${ethers.formatUnits(usdcToWeth, 18)} WETH`);
        
        // Then get WETH->DAI quote
        const wethToDai = await quoter.quoteExactInputSingle(
          WETH, DAI, 3000, usdcToWeth, 0
        );
        console.log(`   WETH->DAI: ${ethers.formatUnits(wethToDai, 18)} DAI`);
        
        return { amountOut: wethToDai, fee: 3000, path: 'USDC->WETH->DAI' };
      } catch (pathError) {
        console.log(`   ❌ USDC->WETH->DAI path failed: ${pathError.message}`);
        if (pathError.code === 'CALL_EXCEPTION') {
          console.log(`   This usually means no WETH liquidity pool exists`);
        }
      }
      
      // Try WETH path also failed
      console.log(`❌ WETH path also failed: missing revert data`);
      console.log(`   This usually means no WETH liquidity pool exists`);
      
      throw new Error('No valid pool found for any fee tier or path');
    } catch (error) {
      console.error('❌ Uniswap V3 price fetch failed:', error.message);
      return null;
    }
  });
}

// Comprehensive price fetching across all DEXes
async function getAllDexPrices(tokenIn, tokenOut, amountIn) {
  const allPrices = [];
  
  for (const [dexKey, dex] of Object.entries(DEXES)) {
    try {
      console.log(`🔍 Checking ${dex.name} for ${ethers.formatUnits(amountIn, decimalsOf(tokenIn))} input`);
      
      let price = null;
      
      if (dex.type === 'v3' && dex.quoterAddress) {
        // Try quoter-based price fetching (Uniswap V3 style)
        price = await getQuoterPrice(dex, tokenIn, tokenOut, amountIn);
      } else if (dex.type === 'v2' && dex.routerAddress) {
        // Try router-based price fetching (Sushiswap V2 style)
        price = await getRouterPrice(dex, tokenIn, tokenOut, amountIn);
      } else if (dex.type === 'solidly' && dex.routerAddress) {
        price = await getSolidlyPrice(dex, tokenIn, tokenOut, amountIn);
      } else if (dex.type === 'curve' && dex.routerAddress) {
        price = await getCurvePrice(dex, tokenIn, tokenOut, amountIn);
      } else if (dex.type === 'balancer' && dex.routerAddress) {
        price = await getBalancerPrice(dex, tokenIn, tokenOut, amountIn);
      }
      
      if (price) {
        allPrices.push({
          dex: dex.name,
          dexKey: dexKey,
          ...price
        });
        console.log(`✅ ${dex.name}: ${ethers.formatUnits(price.amountOut, 18)} (fee: ${price.fee ? price.fee/10000 + '%' : 'N/A'})`);
      }
    } catch (error) {
      console.log(`❌ ${dex.name} failed: ${error.message}`);
    }
  }
  
  return allPrices;
}

// Quoter-based price fetching (for Uniswap V3 style DEXes)
async function getQuoterPrice(dex, tokenIn, tokenOut, amountIn) {
  const singleABI = [
    'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)'
  ];
  const multiABI = [
    'function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut)'
  ];

  const trySingleHop = async (addr) => {
    const quoter = new ethers.Contract(addr, singleABI, provider);
    for (const fee of dex.fees) {
      try {
        // Skip fee tiers without pools to avoid CALL_EXCEPTION spam
        const hasPool = await uniswapV3PoolExists(tokenIn, tokenOut, fee);
        if (!hasPool) continue;
        const amountOut = await quoter.quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, 0);
        if (amountOut && amountOut > 0n) return { amountOut, fee };
      } catch {}
    }
    return null;
  };

  const tryMultiHop = async (addr) => {
    const quoter = new ethers.Contract(addr, multiABI, provider);
    const feeOptions = dex.fees;
    const encodePath = (tokens, fees) => {
      let encoded = '0x';
      for (let i = 0; i < fees.length; i++) {
        encoded += ethers.solidityPacked(['address', 'uint24'], [tokens[i], fees[i]]).slice(2);
      }
      encoded += ethers.solidityPacked(['address'], [tokens[tokens.length - 1]]).slice(2);
      return encoded;
    };
    for (const f1 of feeOptions) {
      for (const f2 of feeOptions) {
        try {
          const path = encodePath([tokenIn, WETH, tokenOut], [f1, f2]);
          const amountOut = await quoter.quoteExactInput(path, amountIn);
          if (amountOut && amountOut > 0n) return { amountOut, fee: f1, path: 'WETH' };
        } catch {}
      }
    }
    return null;
  };

  // Preferred address: dex.quoterAddress, but for Uniswap also try known alternates
  const candidateAddresses = new Set();
  if (dex.quoterAddress) candidateAddresses.add(dex.quoterAddress);
  if (dex.name.toLowerCase().includes('uniswap')) {
    for (const a of UNISWAP_V3_QUOTERS) candidateAddresses.add(a);
  }

  for (const addr of candidateAddresses) {
    // Single hop first
    const single = await trySingleHop(addr);
    if (single) return single;
    // Multi-hop via WETH
    const multi = await tryMultiHop(addr);
    if (multi) return multi;
  }

  return null;
}

// Router-based price fetching (for Sushiswap V2 style DEXes)
async function getRouterPrice(dex, tokenIn, tokenOut, amountIn) {
  const routerABI = [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
  ];
  
  const router = new ethers.Contract(dex.routerAddress, routerABI, provider);
  
  try {
    const path = [tokenIn, tokenOut];
    const amounts = await router.getAmountsOut(amountIn, path);
    return { amountOut: amounts[1], fee: dex.fees[0] };
  } catch (e) {
    // Try WETH path if direct path fails
    try {
      const wethPath = [tokenIn, WETH, tokenOut];
      const amounts = await router.getAmountsOut(amountIn, wethPath);
      return { amountOut: amounts[2], fee: dex.fees[0], path: 'WETH' };
    } catch (wethError) {
      return null;
    }
  }
}

// Solidly-style (Aerodrome) router quoting: getAmountsOut with stable=false/true routes
async function getSolidlyPrice(dex, tokenIn, tokenOut, amountIn) {
  const routerABI = [
    'function getAmountsOut(uint amountIn, address[] memory routes) public view returns (uint[] memory amounts)',
    'function getAmountOut(uint amountIn, address tokenIn, address tokenOut) public view returns (uint amount, bool stable)'
  ];

  const router = new ethers.Contract(dex.routerAddress, routerABI, provider);

  try {
    // Try direct route; Solidly has pools with a stable flag. We ask router which pool (stable/volatile) gives more.
    const res = await router.getAmountOut(amountIn, tokenIn, tokenOut);
    const bestStable = res[1];
    // Route element is tuple: {from, to, stable}
    const routes = [{ from: tokenIn, to: tokenOut, stable: bestStable }];
    // encode as expected: address, address, bool[] – ethers can encode structs; but to keep simple, try direct getAmountOut result
    return { amountOut: res[0], fee: undefined };
  } catch (e) {
    // Try via WETH as intermediate
    try {
      const first = await router.getAmountOut(amountIn, tokenIn, WETH);
      const second = await router.getAmountOut(first[0], WETH, tokenOut);
      return { amountOut: second[0], fee: undefined, path: 'WETH' };
    } catch (e2) {
      return null;
    }
  }
}

// Curve quoting (RouterNG style): get_dy from best pool via router
async function getCurvePrice(dex, tokenIn, tokenOut, amountIn) {
  try {
    const router = new ethers.Contract(dex.routerAddress, [
      'function get_best_rate(address from, address to, uint256 amount) view returns (address pool, uint256 amountOut)'
    ], provider);
    const [, amountOut] = await withTimeout(router.get_best_rate(tokenIn, tokenOut, amountIn), QUOTE_TIMEOUT_MS, [ethers.ZeroAddress, 0n]);
    if (amountOut && amountOut > 0n) return { amountOut };
    return null;
  } catch {
    return null;
  }
}

// Balancer quoting via queryBatchSwap on Vault for a 2-hop route
async function getBalancerPrice(dex, tokenIn, tokenOut, amountIn) {
  try {
    const vault = new ethers.Contract(dex.routerAddress, [
      'function queryBatchSwap(uint8 kind, tuple(bytes32 poolId,uint256 assetInIndex,uint256 assetOutIndex,bytes userData)[] swaps, address[] assets, tuple(address sender,bool fromInternalBalance,address recipient,bool toInternalBalance) funds) returns (int256[] assetDeltas)'
    ], provider);

    // This requires pool IDs; for now return null if not configured
    if (!process.env.BALANCER_POOLID_USDC_DAI || tokenIn === tokenOut) return null;

    // Only support stable USDC<->DAI single-hop via env pool id
    const poolId = process.env.BALANCER_POOLID_USDC_DAI;
    const assets = [tokenIn, tokenOut];
    const swaps = [{ poolId, assetInIndex: 0, assetOutIndex: 1, userData: '0x' }];
    const funds = { sender: ethers.ZeroAddress, fromInternalBalance: false, recipient: ethers.ZeroAddress, toInternalBalance: false };
    const deltas = await withTimeout(vault.queryBatchSwap(0, swaps, assets, funds), QUOTE_TIMEOUT_MS, null);
    if (!deltas) return null;
    const amountOut = BigInt(-deltas[1]);
    if (amountOut > 0n) return { amountOut };
    return null;
  } catch {
    return null;
  }
}

// Compute gas cost in USDC using on-chain ETH price
async function getGasCostInUSDC(estimatedGasUnits) {
  try {
    const gasData = await provider.getFeeData();
    const gasPrice = gasData.gasPrice;
    const gasCostWei = estimatedGasUnits * gasPrice;
    const ethPriceUsdc = await getEthPriceInUSDC(); // USDC (6d) per 1e18 wei
    const gasCostUsdc = (gasCostWei * ethPriceUsdc) / ethers.parseUnits('1', 18);
    return { gasCostUsdc, gasPrice };
  } catch (e) {
    // Fallback: assume 500k gas at 20 gwei and 2000 USDC/ETH
    const gasPrice = ethers.parseUnits('20', 'gwei');
    const gasCostWei = 500000n * gasPrice;
    const ethPriceUsdc = ethers.parseUnits('2000', 6);
    const gasCostUsdc = (gasCostWei * ethPriceUsdc) / ethers.parseUnits('1', 18);
    return { gasCostUsdc, gasPrice };
  }
}

// Compute gas cost in a chosen stable (USDC or USDbC)
async function getGasCostInStable(estimatedGasUnits, stableToken) {
  try {
    const gasData = await provider.getFeeData();
    const gasPrice = gasData.gasPrice;
    const gasCostWei = estimatedGasUnits * gasPrice;
    const ethPriceStable = await getEthPriceInStable(stableToken);
    const gasCostStable = (gasCostWei * ethPriceStable) / ethers.parseUnits('1', 18);
    return { gasCostStable, gasPrice };
  } catch (e) {
    const gasPrice = ethers.parseUnits('20', 'gwei');
    const gasCostWei = 500000n * gasPrice;
    const ethPriceStable = ethers.parseUnits('2000', 6);
    const gasCostStable = (gasCostWei * ethPriceStable) / ethers.parseUnits('1', 18);
    return { gasCostStable, gasPrice };
  }
}

// Generalized: get ETH price in a given 6-dec stable (USDC or USDbC) via Uniswap V3 single-hop if possible, else multi-hop
async function getEthPriceInStable(stableToken) {
  try {
    const oneEth = ethers.parseUnits('1', 18);
    for (const addr of UNISWAP_V3_QUOTERS) {
      try {
        const single = new ethers.Contract(addr, [
          'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)'
        ], provider);
        for (const fee of [500, 3000, 10000]) {
          try {
            const out = await single.quoteExactInputSingle(WETH, stableToken, fee, oneEth, 0);
            if (out && out > 0n) return out;
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return ethers.parseUnits('2000', 6);
}

// Find best two-leg arbitrage USDC -> tokenOut (buy) and tokenOut -> USDC (sell)
async function findBestArbitrageOpportunityFor(tokenOut, tokenOutLabel = 'TOKEN', baseStable = USDC, baseStableLabel = 'USDC') {
  console.log(`🔎 Building cross-DEX quotes for ${baseStableLabel} ⇄ ${tokenOutLabel}...`);
  // Amount in baseStable decimals
  const baseDecimals = decimalsOf(baseStable);
  const baseAmount = ethers.parseUnits(ethers.formatUnits(AMOUNT, 6), baseDecimals);
  // Get buy quotes: baseStable -> tokenOut
  const buyQuotes = await getAllDexPrices(baseStable, tokenOut, baseAmount);
  if (buyQuotes.length === 0) {
    return { profitable: false, reason: `No ${baseStableLabel}→${tokenOutLabel} quotes`, pair: `${baseStableLabel}/${tokenOutLabel}` };
  }

  // Estimate gas and convert to USDC
  let estimatedGas;
  try {
    estimatedGas = await contract.executeArbitrage.estimateGas(baseStable, baseAmount, MIN_PROFIT_USD);
  } catch (e) {
    estimatedGas = 500000n;
  }
  const { gasCostStable } = await getGasCostInStable(estimatedGas, baseStable);

  let best = null;

  // For each buy, get sell quotes for the resulting DAI amount
  for (const buy of buyQuotes) {
    const daiOut = buy.amountOut; // 18 decimals
    const sellQuotes = await getAllDexPrices(tokenOut, baseStable, daiOut);
    if (sellQuotes.length === 0) continue;

    // Best sell is the one with max USDC out
    const bestSell = sellQuotes.reduce((a, b) => (b.amountOut > a.amountOut ? b : a));
    const backAmount = bestSell.amountOut; // in baseStable decimals
    const profitStable = backAmount - baseAmount - gasCostStable; // same decimals

    if (!best || profitStable > best.profitUsdc) {
      best = {
        buyDex: buy.dex,
        buyFee: buy.fee,
        sellDex: bestSell.dex,
        sellFee: bestSell.fee,
        daiReceived: daiOut,
        usdcReturned: backAmount,
        gasCostUsdc: gasCostStable,
        profitUsdc: profitStable,
        baseDecimals
      };
    }
  }

  if (!best) {
    return { profitable: false, reason: `No ${tokenOutLabel}→${baseStableLabel} quotes`, pair: `${baseStableLabel}/${tokenOutLabel}` };
  }

  const minProfitRequired = ethers.parseUnits(MIN_PROFIT_INPUT || '0.5', baseDecimals);
  const meetsMinProfit = best.profitUsdc >= minProfitRequired;
  return {
    profitable: best.profitUsdc > 0 && meetsMinProfit,
    ...best,
    pair: `${baseStableLabel}/${tokenOutLabel}`,
    reason: best.profitUsdc > 0 ? (meetsMinProfit ? 'Profitable' : 'Below threshold') : 'Not profitable'
  };
}

async function getSushiswapV2Price(tokenIn, tokenOut, amountIn) {
  return retryWithBackoff(async () => {
    try {
      console.log(`🔍 Attempting Sushiswap V2 price fetch...`);
      console.log(`   Token In: ${tokenIn} (DAI)`);
      console.log(`   Token Out: ${tokenOut} (USDC)`);
      console.log(`   Amount In: ${ethers.formatUnits(amountIn, 18)} DAI`);
      
      // Base mainnet Sushiswap V2 Router - verified address
      const routerAddress = '0x6e086AbE2ECB3f660b15Fb3a3ef0028BE6a4a1e0';
      console.log(`   Router Address: ${routerAddress}`);
      
      const routerABI = [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
      ];
      
      const router = new ethers.Contract(routerAddress, routerABI, provider);
      
      // Try direct path first
      try {
        const directPath = [tokenIn, tokenOut];
        console.log(`🔍 Trying Sushiswap V2 direct path: ${tokenIn} → ${tokenOut}`);
        const amounts = await router.getAmountsOut(amountIn, directPath);
        console.log(`✅ Sushiswap V2 direct quote successful: ${ethers.formatUnits(amounts[1], 6)} USDC`);
        return amounts[1];
      } catch (directError) {
        console.log(`⚠️  Direct path failed, trying WETH path: ${directError.message}`);
        if (directError.code === 'CALL_EXCEPTION') {
          console.log(`   This usually means no direct liquidity pool exists`);
        }
        
        // Try path through WETH as intermediate token
        try {
          const wethPath = [tokenIn, WETH, tokenOut];
          console.log(`🔍 Trying Sushiswap V2 WETH path: ${tokenIn} → WETH → ${tokenOut}`);
          const amounts = await router.getAmountsOut(amountIn, wethPath);
          console.log(`✅ Sushiswap V2 WETH path quote successful: ${ethers.formatUnits(amounts[2], 6)} USDC`);
          return amounts[2];
        } catch (wethError) {
          console.log(`⚠️  WETH path also failed: ${wethError.message}`);
          if (wethError.code === 'CALL_EXCEPTION') {
            console.log(`   This usually means no WETH liquidity pool exists`);
          }
          throw new Error('Both direct and WETH paths failed');
        }
      }
    } catch (error) {
      console.error('❌ Sushiswap V2 price fetch failed:', error.message);
      return null;
    }
  });
}

async function checkProfitability() {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Fetching real-time prices from ALL DEXes...');
    console.log(`📊 Checking prices for ${ethers.formatUnits(AMOUNT, 6)} USDC across multiple DEXes...`);
    
    // Get prices from all DEXes for maximum coverage
    const allDexPrices = await getAllDexPrices(USDC, DAI, AMOUNT);
    
    if (allDexPrices.length === 0) {
      console.log('❌ No DEX prices available - all DEXes failed');
      return { 
        profitable: false, 
        profit: 0n, 
        gasCost: 0n, 
        reason: 'All DEXes failed - no arbitrage opportunity'
      };
    }
    
    console.log(`✅ Found prices from ${allDexPrices.length} DEXes`);
    
    // Find the best buy and sell opportunities
    const bestBuy = allDexPrices.reduce((best, current) => 
      current.amountOut > best.amountOut ? current : best
    );
    
    const bestSell = allDexPrices.reduce((best, current) => 
      current.amountOut < best.amountOut ? current : best
    );
    
    console.log(`📊 Best Buy: ${bestBuy.dex} - ${ethers.formatUnits(bestBuy.amountOut, 18)} DAI`);
    console.log(`📊 Best Sell: ${bestSell.dex} - ${ethers.formatUnits(bestSell.amountOut, 18)} DAI`);
    
    // Calculate potential profit
    const input = AMOUNT;
    const outputUni = bestBuy.amountOut;
    const outputSushi = bestSell.amountOut;
    
    // Estimate gas costs (more accurate for mainnet)
    let gasEst, gasPrice, gasCost;
    try {
      gasEst = await contract.executeArbitrage.estimateGas(USDC, AMOUNT, MIN_PROFIT_USD);
      gasPrice = await provider.getFeeData();
      gasCost = gasEst * gasPrice.gasPrice;
    } catch (gasError) {
      console.log('⚠️  Gas estimation failed, using default estimate:', gasError.message);
      // Use default gas estimate if contract call fails
      gasPrice = await provider.getFeeData();
      gasCost = 500000n * gasPrice.gasPrice; // Default 500k gas
      gasEst = 500000n;
    }
    
    // Convert gas cost from ETH to USDC equivalent for proper profit calculation
    const ethPriceUsd = 2000n; // Approximate ETH price in USD
    const gasCostUsd = (gasCost * ethPriceUsd) / ethers.parseUnits('1', 18); // Convert to USD
    
    const profit = outputSushi - input - gasCostUsd;
    const profitUsd = ethers.formatUnits(profit, 6);
    const gasCostEth = ethers.formatEther(gasCost);

    console.log(`📊 Multi-DEX Price Analysis:`);
    console.log(`   Buy: ${bestBuy.dex} USDC→DAI: ${ethers.formatUnits(bestBuy.amountOut, 18)} DAI (Fee: ${bestBuy.fee/10000}%)`);
    console.log(`   Sell: ${bestSell.dex} DAI→USDC: ${ethers.formatUnits(bestSell.amountOut, 6)} USDC`);
    console.log(`   Gas Cost: ${gasCostEth} ETH (≈$${ethers.formatUnits(gasCostUsd, 6)})`);
    console.log(`   Potential Profit: ${profitUsd} USDC`);
    
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
      reason: isProfitable ? 'Profitable (multi-DEX)' : (profit > 0 ? 'Below threshold (multi-DEX)' : 'Not profitable (multi-DEX)')
    };
  } catch (error) {
    console.error('❌ Error checking profitability:', error.message);
    return { profitable: false, profit: 0n, gasCost: 0n, reason: 'Error occurred' };
  }
}

async function executeArbitrage() {
  try {
    console.log('🚀 Executing arbitrage on mainnet...');
    
    // Get current gas price
    const gasData = await provider.getFeeData();
    const gasPrice = gasData.gasPrice;
    
    console.log(`⛽ Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    
    // Estimate gas for the transaction
    const gasEstimate = await contract.executeArbitrage.estimateGas(USDC, AMOUNT, MIN_PROFIT_USD);
    console.log(`⛽ Gas Estimate: ${gasEstimate.toLocaleString()}`);
    
    // Calculate gas cost
    const gasCost = gasEstimate * gasPrice;
    const gasCostEth = ethers.formatEther(gasCost);
    console.log(`⛽ Estimated Gas Cost: ${gasCostEth} ETH`);
    
    // Execute the arbitrage
    console.log('📡 Sending transaction...');
    const tx = await contract.executeArbitrage(USDC, AMOUNT, MIN_PROFIT_USD, {
      gasLimit: gasEstimate,
      gasPrice: gasPrice
    });
    
    console.log(`📋 Transaction Hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log('✅ Arbitrage executed successfully!');
      console.log(`📊 Gas Used: ${receipt.gasUsed.toLocaleString()}`);
      console.log(`💰 Actual Gas Cost: ${ethers.formatEther(receipt.gasUsed * gasPrice)} ETH`);
      return { success: true, txHash: tx.hash, gasUsed: receipt.gasUsed };
    } else {
      console.log('❌ Transaction failed');
      return { success: false, error: 'Transaction failed' };
    }
    
  } catch (error) {
    console.error('❌ Arbitrage execution failed:', error.message);
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('💡 Try reducing the trade amount or add more ETH for gas');
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      console.log('💡 Gas estimation failed, try manually setting gas limit');
    }
    
    return { success: false, error: error.message };
  }
}

async function checkWalletBalance() {
  try {
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    
    console.log(`💰 Wallet Balance: ${balanceEth} ETH`);
    
    // Check if we have enough ETH for gas (minimum 0.01 ETH)
    const minEthRequired = ethers.parseEther('0.01');
    if (balance < minEthRequired) {
      console.log('❌ Insufficient ETH for gas fees');
      console.log(`   Required: ${ethers.formatEther(minEthRequired)} ETH`);
      console.log(`   Available: ${balanceEth} ETH`);
      return false;
    }
    
    console.log('✅ Sufficient ETH balance for gas fees');
    return true;
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error.message);
    return false;
  }
}

// Performance tracking
let totalChecks = 0;
let successfulPriceFetches = 0;
let failedPriceFetches = 0;
let averageResponseTime = 0;
let lastGasPrice = 0n;

// Smart gas optimization
async function getOptimizedGasSettings() {
  try {
    // Get current gas data
    const gasData = await provider.getFeeData();
    
    // Use legacy gas pricing for better compatibility
    const gasPrice = gasData.gasPrice || gasData.lastBaseFeePerGas * 2n;
    
    // Estimate gas limit for the arbitrage transaction
    let gasLimit;
    try {
      gasLimit = await contract.executeArbitrage.estimateGas(USDC, AMOUNT, MIN_PROFIT_USD);
      // Add 20% buffer for safety
      gasLimit = gasLimit * 120n / 100n;
    } catch (error) {
      console.log('⚠️  Gas estimation failed, using default estimate');
      gasLimit = 500000n; // Default gas limit
    }
    
    return {
      gasLimit,
      gasPrice,
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: gasPrice
    };
  } catch (error) {
    console.error('❌ Error getting gas settings:', error.message);
    // Return safe defaults
    return {
      gasLimit: 500000n,
      gasPrice: ethers.parseUnits('20', 'gwei'),
      maxFeePerGas: ethers.parseUnits('20', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('20', 'gwei')
    };
  }
}

// Check multiple token pairs for arbitrage opportunities
async function checkAllTokenPairs() {
  console.log('🔍 Checking ALL token pairs across ALL DEXes...');
  
  const allOpportunities = [];
  
  for (const pair of TOKEN_PAIRS) {
    try {
      console.log(`\n📊 Checking ${pair.name} pair...`);
      
      // Get prices from all DEXes for this pair
      const prices = await getAllDexPrices(pair.tokenA, pair.tokenB, AMOUNT);
      
      if (prices.length > 1) {
        // Find best buy and sell opportunities
        const bestBuy = prices.reduce((best, current) => 
          current.amountOut > best.amountOut ? current : best
        );
        
        const bestSell = prices.reduce((best, current) => 
          current.amountOut < best.amountOut ? current : best
        );
        
        // Calculate potential profit
        const input = AMOUNT;
        const outputBuy = bestBuy.amountOut;
        const outputSell = bestSell.amountOut;
        
        // Estimate gas cost
        const gasCost = 500000n * (await provider.getFeeData()).gasPrice;
        const gasCostUsd = (gasCost * 2000n) / ethers.parseUnits('1', 18);
        
        const profit = outputSell - input - gasCostUsd;
        
        if (profit > 0) {
          const opportunity = {
            pair: pair.name,
            tokenA: pair.tokenA,
            tokenB: pair.tokenB,
            buyDex: bestBuy.dex,
            sellDex: bestSell.dex,
            buyAmount: bestBuy.amountOut,
            sellAmount: bestSell.amountOut,
            profit: profit,
            gasCost: gasCostUsd
          };
          
          allOpportunities.push(opportunity);
          
          console.log(`💰 ${pair.name} opportunity found!`);
          console.log(`   Buy: ${bestBuy.dex} - ${ethers.formatUnits(bestBuy.amountOut, 18)}`);
          console.log(`   Sell: ${bestSell.dex} - ${ethers.formatUnits(bestSell.amountOut, 18)}`);
          console.log(`   Profit: ${ethers.formatUnits(profit, 18)}`);
        }
      }
    } catch (error) {
      console.log(`❌ ${pair.name} check failed: ${error.message}`);
    }
  }
  
  // Sort opportunities by profit (highest first)
  allOpportunities.sort((a, b) => b.profit - a.profit);
  
  return allOpportunities;
}

// Enhanced main function with multi-DEX and multi-pair checking
async function main() {
  console.log('🔄 Starting enhanced multi-DEX arbitrage monitoring...\n');
  console.log('🚀 Multi-DEX Coverage:');
  console.log('   - Uniswap V3 (0.05%, 0.3%, 1% fees)');
  console.log('   - BaseSwap (0.01%, 0.05%, 0.3%, 1% fees)');
  console.log('   - Aerodrome (0.01%, 0.05%, 0.3%, 1% fees)');
  console.log('   - Sushiswap V2 (0.3% fee)');
  console.log('   - AlienBase (0.01%, 0.05%, 0.3%, 1% fees)');
  console.log('\n🔍 Token Pairs:');
  console.log('   - USDC/DAI, USDC/WETH, DAI/WETH');
  console.log('   - USDC/cbETH, DAI/cbETH, WETH/cbETH');
  console.log('\n⚡ Features:');
  console.log('   - Multi-DEX price comparison');
  console.log('   - Multi-token pair scanning');
  console.log('   - Best arbitrage opportunity detection');
  console.log('   - Gas cost optimization');
  
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
      
      // Cross-DEX two-leg scan across many pairs
      console.log('🔍 Scanning cross-DEX pairs for arbitrage opportunities...');
      const candidates = [];
      const baseStables = [
        { addr: USDC, label: 'USDC' },
        { addr: USDBC, label: 'USDbC' },
        { addr: DAI, label: 'DAI' }
      ].filter(t => !!t.addr);
      const tokenCatalog = [
        { addr: USDC, label: 'USDC' },
        { addr: USDBC, label: 'USDbC' },
        { addr: DAI, label: 'DAI' },
        { addr: WETH, label: 'WETH' },
        { addr: CBETH, label: 'cbETH' },
        { addr: USDT, label: 'USDT' },
        { addr: WBTC, label: 'WBTC' },
        { addr: WSTETH, label: 'wstETH' },
        { addr: AERO, label: 'AERO' }
      ].filter(t => !!t.addr);
      for (const base of baseStables) {
        for (const tok of tokenCatalog) {
          if (tok.addr && base.addr && tok.addr.toLowerCase() === base.addr.toLowerCase()) continue;
          candidates.push(await findBestArbitrageOpportunityFor(tok.addr, tok.label, base.addr, base.label));
        }
      }

      const withProfit = candidates.filter(c => c && c.profitUsdc !== undefined);
      // Pick best profitable candidate if any
      const arb = withProfit.length > 0
        ? withProfit.reduce((a, b) => (a && a.profitUsdc > b.profitUsdc ? a : b))
        : null;

      if (arb && arb.profitable) {
        console.log(`\n🏆 Profitable opportunity found!`);
        console.log(`   Buy on: ${arb.buyDex} (fee: ${arb.buyFee ? arb.buyFee/10000 + '%' : 'n/a'})`);
        console.log(`   Sell on: ${arb.sellDex} (fee: ${arb.sellFee ? arb.sellFee/10000 + '%' : 'n/a'})`);
        console.log(`   DAI received: ${ethers.formatUnits(arb.daiReceived, 18)}`);
        console.log(`   USDC back: ${ethers.formatUnits(arb.usdcReturned, 6)}`);
        console.log(`   Gas cost: ${ethers.formatUnits(arb.gasCostUsdc, 6)} USDC`);
        console.log(`   Profit: ${ethers.formatUnits(arb.profitUsdc, 6)} USDC`);

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
        // Print per-pair reasons for transparency
        for (const c of candidates) {
          if (!c) continue;
          if (c.profitUsdc !== undefined) {
            console.log(`😔 ${c.pair}: Not profitable (profit ${ethers.formatUnits(c.profitUsdc, 6)} USDC)`);
          } else {
            console.log(`😔 ${c.pair || 'Pair'}: ${c.reason}`);
          }
        }
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

// Health check function
async function runHealthCheck() {
  try {
    console.log('🏥 Running health check...');
    
    // Check network connection
    const blockNumber = await provider.getBlockNumber();
    console.log(`   Network: Connected (Block: ${blockNumber})`);
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`   Wallet: ${ethers.formatEther(balance)} ETH`);
    
    // Check gas price
    const gasData = await provider.getFeeData();
    console.log(`   Gas Price: ${ethers.formatUnits(gasData.gasPrice, 'gwei')} gwei`);
    
    // Check contract status
    try {
      const contractBalance = await contract.getContractBalance();
      console.log(`   Contract: ${ethers.formatUnits(contractBalance, 6)} USDC`);
    } catch (e) {
      console.log(`   Contract: Status check failed - ${e.message}`);
    }
    
    console.log('✅ Health check completed successfully\n');
  } catch (error) {
    console.log(`⚠️  Health check failed: ${error.message}\n`);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Enhanced Multi-DEX CryptoBot...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Enhanced Multi-DEX CryptoBot...');
  process.exit(0);
});

// Start the bot
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});