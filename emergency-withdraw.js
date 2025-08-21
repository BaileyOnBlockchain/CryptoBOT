// Emergency Withdrawal Script for CryptoBot
require('dotenv').config();
const { ethers } = require('ethers');

async function emergencyWithdraw() {
    console.log('💰 EMERGENCY WITHDRAWAL INITIATED');
    
    if (!process.env.WALLET_KEY || !process.env.CONTRACT_ADDRESS) {
        console.error('❌ Missing WALLET_KEY or CONTRACT_ADDRESS in .env');
        return;
    }
    
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_KEY, provider);
    
    const contractABI = [
        'function withdrawToken(address token, uint256 amount) external',
        'function withdrawETH() external',
        'function getTokenBalance(address token) view returns (uint256)',
        'function getETHBalance() view returns (uint256)',
        'function owner() view returns (address)'
    ];
    
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
    
    // Token addresses
    const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const DAI = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';
    
    try {
        // Check ownership
        const owner = await contract.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error('❌ You are not the contract owner!');
            return;
        }
        
        console.log('📊 Checking contract balances...');
        
        // Check balances
        const usdcBalance = await contract.getTokenBalance(USDC);
        const daiBalance = await contract.getTokenBalance(DAI);
        const ethBalance = await contract.getETHBalance();
        
        console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
        console.log(`   DAI: ${ethers.formatUnits(daiBalance, 18)}`);
        console.log(`   ETH: ${ethers.formatEther(ethBalance)}`);
        
        const transactions = [];
        
        // Withdraw USDC if any
        if (usdcBalance > 0) {
            console.log('💵 Withdrawing USDC...');
            const usdcTx = await contract.withdrawToken(USDC, usdcBalance);
            console.log(`📝 USDC Withdrawal TX: ${usdcTx.hash}`);
            transactions.push(usdcTx);
        }
        
        // Withdraw DAI if any  
        if (daiBalance > 0) {
            console.log('💴 Withdrawing DAI...');
            const daiTx = await contract.withdrawToken(DAI, daiBalance);
            console.log(`📝 DAI Withdrawal TX: ${daiTx.hash}`);
            transactions.push(daiTx);
        }
        
        // Withdraw ETH if any
        if (ethBalance > 0) {
            console.log('⚡ Withdrawing ETH...');
            const ethTx = await contract.withdrawETH();
            console.log(`📝 ETH Withdrawal TX: ${ethTx.hash}`);
            transactions.push(ethTx);
        }
        
        // Wait for all transactions
        console.log('⏳ Waiting for confirmations...');
        for (const tx of transactions) {
            await tx.wait();
            console.log(`✅ Confirmed: ${tx.hash}`);
        }
        
        console.log('\n🎉 Emergency withdrawal complete!');
        console.log('💰 All funds have been transferred to your wallet');
        
    } catch (error) {
        console.error('❌ Emergency withdrawal failed:', error.message);
        
        if (error.message.includes('insufficient funds')) {
            console.log('💡 No funds to withdraw or insufficient gas');
        } else if (error.message.includes('paused')) {
            console.log('💡 Contract is paused - funds are safe but locked');
        }
    }
}

// Run emergency withdrawal
emergencyWithdraw().catch(console.error);
