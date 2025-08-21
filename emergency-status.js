// Emergency Status Checker for CryptoBot
require('dotenv').config();
const { ethers } = require('ethers');

async function checkEmergencyStatus() {
    console.log('📊 EMERGENCY STATUS CHECK');
    console.log('==========================\n');
    
    if (!process.env.WALLET_KEY || !process.env.CONTRACT_ADDRESS) {
        console.error('❌ Missing WALLET_KEY or CONTRACT_ADDRESS in .env');
        return;
    }
    
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_KEY, provider);
    
    const contractABI = [
        'function paused() view returns (bool)',
        'function emergencyStop() view returns (bool)',
        'function owner() view returns (address)',
        'function getTokenBalance(address token) view returns (uint256)',
        'function getETHBalance() view returns (uint256)',
        'function minProfitThreshold() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, provider);
    
    // Token addresses
    const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const DAI = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';
    
    try {
        console.log('🔍 Contract Status:');
        const [paused, emergencyStop, owner, usdcBalance, daiBalance, ethBalance, minProfit] = await Promise.all([
            contract.paused(),
            contract.emergencyStop(),
            contract.owner(),
            contract.getTokenBalance(USDC),
            contract.getTokenBalance(DAI),
            contract.getETHBalance(),
            contract.minProfitThreshold()
        ]);
        
        console.log(`   Contract Address: ${process.env.CONTRACT_ADDRESS}`);
        console.log(`   Paused: ${paused ? '🔴 YES' : '🟢 NO'}`);
        console.log(`   Emergency Stop: ${emergencyStop ? '🔴 ACTIVE' : '🟢 INACTIVE'}`);
        console.log(`   Owner: ${owner}`);
        console.log(`   Your Address: ${wallet.address}`);
        console.log(`   You are Owner: ${owner.toLowerCase() === wallet.address.toLowerCase() ? '✅ YES' : '❌ NO'}`);
        
        console.log('\n💰 Contract Balances:');
        console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
        console.log(`   DAI: ${ethers.formatUnits(daiBalance, 18)}`);
        console.log(`   ETH: ${ethers.formatEther(ethBalance)}`);
        console.log(`   Min Profit Threshold: $${ethers.formatUnits(minProfit, 6)} USDC`);
        
        console.log('\n👛 Your Wallet Balance:');
        const walletBalance = await provider.getBalance(wallet.address);
        console.log(`   ETH: ${ethers.formatEther(walletBalance)}`);
        
        console.log('\n🔗 Links:');
        console.log(`   Contract on BaseScan: https://basescan.org/address/${process.env.CONTRACT_ADDRESS}`);
        console.log(`   Your Wallet on BaseScan: https://basescan.org/address/${wallet.address}`);
        
        console.log('\n⚡ Quick Actions:');
        if (!paused && !emergencyStop) {
            console.log('   🟢 System is RUNNING normally');
            console.log('   📝 To stop: npm run emergency:stop');
        } else {
            console.log('   🔴 System is STOPPED');
            console.log('   📝 To withdraw funds: npm run emergency:withdraw');
        }
        
        const totalValue = parseFloat(ethers.formatUnits(usdcBalance, 6)) + parseFloat(ethers.formatUnits(daiBalance, 18));
        if (totalValue > 0) {
            console.log(`   💰 Total value in contract: ~$${totalValue.toFixed(2)}`);
        }
        
    } catch (error) {
        console.error('❌ Status check failed:', error.message);
        console.log('💡 Check your .env file and network connection');
    }
}

// Run status check
checkEmergencyStatus().catch(console.error);
