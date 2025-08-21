// Emergency Status Checker for CryptoBot (Local Version)
require('dotenv').config();
const { ethers } = require('ethers');

async function checkEmergencyStatus() {
    console.log('📊 EMERGENCY STATUS CHECK (LOCAL)');
    console.log('==================================\n');
    
    if (!process.env.WALLET_KEY || !process.env.CONTRACT_ADDRESS) {
        console.error('❌ Missing WALLET_KEY or CONTRACT_ADDRESS in .env');
        console.log('Current values:');
        console.log('WALLET_KEY:', process.env.WALLET_KEY ? '✅ FOUND' : '❌ MISSING');
        console.log('CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS ? '✅ FOUND' : '❌ MISSING');
        return;
    }
    
    // Use local Hardhat network
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const wallet = new ethers.Wallet(process.env.WALLET_KEY, provider);
    
    const contractABI = [
        'function paused() view returns (bool)',
        'function emergencyStop() view returns (bool)',
        'function owner() view returns (address)',
        'function getTokenBalance(address token) view returns (uint256)',
        'function getETHBalance() view returns (uint256)',
        'function minProfitThreshold() view returns (uint256)'
    ];
    
    try {
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, provider);
        
        console.log('🔍 Contract Status:');
        console.log(`   Contract Address: ${process.env.CONTRACT_ADDRESS}`);
        console.log(`   Your Address: ${wallet.address}`);
        
        // Check if contract exists
        const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
        if (code === '0x') {
            console.log('❌ Contract not found at this address');
            console.log('💡 Make sure you deployed the contract first using: npm run deploy:local');
            return;
        }
        
        console.log('✅ Contract found and accessible');
        
        // Get contract details
        const [paused, emergencyStop, owner, minProfit] = await Promise.all([
            contract.paused(),
            contract.emergencyStop(),
            contract.owner(),
            contract.minProfitThreshold()
        ]);
        
        console.log(`   Paused: ${paused ? '🔴 YES' : '🟢 NO'}`);
        console.log(`   Emergency Stop: ${emergencyStop ? '🔴 ACTIVE' : '🟢 INACTIVE'}`);
        console.log(`   Owner: ${owner}`);
        console.log(`   You are Owner: ${owner.toLowerCase() === wallet.address.toLowerCase() ? '✅ YES' : '❌ NO'}`);
        console.log(`   Min Profit Threshold: $${ethers.formatUnits(minProfit, 6)} USDC`);
        
        // Check balances
        const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const daiAddress = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';
        
        try {
            const [usdcBalance, daiBalance, ethBalance] = await Promise.all([
                contract.getTokenBalance(usdcAddress),
                contract.getTokenBalance(daiAddress),
                contract.getETHBalance()
            ]);
            
            console.log('\n💰 Contract Balances:');
            console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
            console.log(`   DAI: ${ethers.formatUnits(daiBalance, 18)}`);
            console.log(`   ETH: ${ethers.formatEther(ethBalance)}`);
        } catch (balanceError) {
            console.log('\n💰 Contract Balances: Unable to fetch (contract might not have these functions yet)');
        }
        
        console.log('\n👛 Your Wallet Balance:');
        const walletBalance = await provider.getBalance(wallet.address);
        console.log(`   ETH: ${ethers.formatEther(walletBalance)}`);
        
        console.log('\n⚡ Quick Actions:');
        if (!paused && !emergencyStop) {
            console.log('   🟢 System is RUNNING normally');
            console.log('   📝 To stop: npm run emergency:stop');
        } else {
            console.log('   🔴 System is STOPPED');
            console.log('   📝 To withdraw funds: npm run emergency:withdraw');
        }
        
        console.log('\n🔗 Local Network Info:');
        console.log(`   Network: Local Hardhat (http://127.0.0.1:8545)`);
        console.log(`   Contract: ${process.env.CONTRACT_ADDRESS}`);
        
    } catch (error) {
        console.error('❌ Status check failed:', error.message);
        console.log('\n💡 Troubleshooting:');
        console.log('1. Make sure Hardhat is running: npx hardhat node');
        console.log('2. Deploy contract first: npm run deploy:local');
        console.log('3. Check your .env file has correct values');
    }
}

// Run status check
checkEmergencyStatus().catch(console.error);
