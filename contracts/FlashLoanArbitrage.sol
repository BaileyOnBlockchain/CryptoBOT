// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Enhanced Uniswap V3 interface
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

// Enhanced Sushiswap V2 interface
interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

contract FlashLoanArbitrage is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Routers/tokens – set at deploy based on chain
    address public UNISWAP_V3_ROUTER;
    address public SUSHISWAP_V2_ROUTER;
    address public USDC;
    address public DAI;
    address public WETH;
    
    // Configuration
    uint256 public minProfitThreshold = 5 * 10**6; // $5 USDC minimum profit
    uint256 public maxSlippage = 50; // 0.5% slippage tolerance
    bool public emergencyStop = false;
    
    // Events
    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit,
        uint256 gasUsed,
        uint256 timestamp
    );
    
    event FlashLoanRequested(
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    event ProfitThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    event EmergencyStopToggled(bool stopped);
    
    // Modifiers
    modifier whenNotStopped() {
        require(!emergencyStop, "Contract is in emergency stop mode");
        _;
    }
    
    modifier validToken(address token) {
        require(token == USDC || token == DAI || token == WETH, "Unsupported token");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        if (block.chainid == 8453) {
            // Base Mainnet
            UNISWAP_V3_ROUTER = 0x2626664C2603336e57b271C5c0B26f421741E8eE;
            SUSHISWAP_V2_ROUTER = 0x6e086AbE2ECB3f660b15Fb3a3ef0028BE6a4a1e0;
            USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
            DAI = 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb;
            WETH = 0x4200000000000000000000000000000000000006;
        } else if (block.chainid == 42161) {
            // Arbitrum One
            UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
            SUSHISWAP_V2_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
            USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
            DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
            WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
        } else {
            // Default to Base addresses
            UNISWAP_V3_ROUTER = 0x2626664C2603336e57b271C5c0B26f421741E8eE;
            SUSHISWAP_V2_ROUTER = 0x6e086AbE2ECB3f660b15Fb3a3ef0028BE6a4a1e0;
            USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
            DAI = 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb;
            WETH = 0x4200000000000000000000000000000000000006;
        }
    }
    
    // Main arbitrage function
    function executeArbitrage(
        address token,
        uint256 amount,
        uint256 minProfit
    ) external onlyOwner whenNotStopped whenNotPaused nonReentrant validToken(token) {
        require(amount > 0, "Amount must be greater than 0");
        require(minProfit >= minProfitThreshold, "Profit below minimum threshold");
        
        uint256 initialBalance = IERC20(token).balanceOf(address(this));
        uint256 gasStart = gasleft();
        
        // Execute the arbitrage strategy
        uint256 finalBalance = _executeArbitrageStrategy(token, amount);
        
        // Calculate profit
        uint256 profit = finalBalance - initialBalance;
        require(profit >= minProfit, "Insufficient profit");
        
        uint256 gasUsed = gasStart - gasleft();
        
        emit ArbitrageExecuted(token, amount, profit, gasUsed, block.timestamp);
    }
    
    // Internal arbitrage strategy
    function _executeArbitrageStrategy(address token, uint256 amount) internal returns (uint256) {
        if (token == USDC) {
            return _executeUSDCToDAIArbitrage(amount);
        } else if (token == DAI) {
            return _executeDAIToUSDCArbitrage(amount);
        } else {
            revert("Token not supported for arbitrage");
        }
    }
    
    // USDC -> DAI -> USDC arbitrage
    function _executeUSDCToDAIArbitrage(uint256 amount) internal returns (uint256) {
        // Step 1: Swap USDC to DAI on Uniswap V3
        IERC20(USDC).approve(UNISWAP_V3_ROUTER, amount);
        
        uint256 daiReceived = IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: USDC,
                tokenOut: DAI,
                fee: 3000, // 0.3% fee tier
                recipient: address(this),
                deadline: block.timestamp + 1800,
                amountIn: amount,
                amountOutMinimum: 0, // No slippage protection for now
                sqrtPriceLimitX96: 0
            })
        );
        
        // Step 2: Swap DAI back to USDC on Sushiswap V2
        IERC20(DAI).approve(SUSHISWAP_V2_ROUTER, daiReceived);
        
        address[] memory path = new address[](2);
        path[0] = DAI;
        path[1] = USDC;
        
        uint256[] memory amounts = IUniswapV2Router02(SUSHISWAP_V2_ROUTER).swapExactTokensForTokens(
            daiReceived,
            0, // No slippage protection for now
            path,
            address(this),
            block.timestamp + 1800
        );
        
        return amounts[1];
    }
    
    // DAI -> USDC -> DAI arbitrage
    function _executeDAIToUSDCArbitrage(uint256 amount) internal returns (uint256) {
        // Step 1: Swap DAI to USDC on Sushiswap V2
        IERC20(DAI).approve(SUSHISWAP_V2_ROUTER, amount);
        
        address[] memory path = new address[](2);
        path[0] = DAI;
        path[1] = USDC;
        
        uint256[] memory amounts = IUniswapV2Router02(SUSHISWAP_V2_ROUTER).swapExactTokensForTokens(
            amount,
            0, // No slippage protection for now
            path,
            address(this),
            block.timestamp + 1800
        );
        
        // Step 2: Swap USDC back to DAI on Uniswap V3
        IERC20(USDC).approve(UNISWAP_V3_ROUTER, amounts[1]);
        
        uint256 daiReceived = IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: USDC,
                tokenOut: DAI,
                fee: 3000, // 0.3% fee tier
                recipient: address(this),
                deadline: block.timestamp + 1800,
                amountIn: amounts[1],
                amountOutMinimum: 0, // No slippage protection for now
                sqrtPriceLimitX96: 0
            })
        );
        
        return daiReceived;
    }
    
    // Placeholder for flash loan functionality
    function requestFlashLoan(address _token, uint256 _amount) public onlyOwner whenNotStopped {
        emit FlashLoanRequested(_token, _amount, block.timestamp);
        // Flash loan logic will be implemented here
    }
    
    // Admin functions
    function setProfitThreshold(uint256 _newThreshold) external onlyOwner {
        uint256 oldThreshold = minProfitThreshold;
        minProfitThreshold = _newThreshold;
        emit ProfitThresholdUpdated(oldThreshold, _newThreshold);
    }
    
    function setSlippage(uint256 _newSlippage) external onlyOwner {
        require(_newSlippage <= 1000, "Slippage too high"); // Max 10%
        uint256 oldSlippage = maxSlippage;
        maxSlippage = _newSlippage;
        emit SlippageUpdated(oldSlippage, _newSlippage);
    }
    
    function toggleEmergencyStop() external onlyOwner {
        emergencyStop = !emergencyStop;
        emit EmergencyStopToggled(emergencyStop);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Emergency functions
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // View functions
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Receive function to accept ETH
    receive() external payable {}
}