// Manual Emergency Commands for CryptoBot
require('dotenv').config();
const { ethers } = require('ethers');

async function manualEmergency() {
    console.log('🔧 MANUAL EMERGENCY COMMANDS');
    
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_KEY, provider);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, [
        'function pause() external',
        'function toggleEmergencyStop() external', 
        'function withdrawToken(address,uint256) external',
        'function withdrawETH() external'
    ], wallet);
    
    console.log('\n📋 Available Emergency Commands:');
    console.log('1. Pause Contract:');
    console.log('   await contract.pause()');
    
    console.log('\n2. Emergency Stop:');
    console.log('   await contract.toggleEmergencyStop()');
    
    console.log('\n3. Withdraw USDC:');
    console.log('   await contract.withdrawToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount)');
    
    console.log('\n4. Withdraw DAI:');
    console.log('   await contract.withdrawToken("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", amount)');
    
    console.log('\n5. Withdraw ETH:');
    console.log('   await contract.withdrawETH()');
    
    console.log('\n🔗 Contract Address:', process.env.CONTRACT_ADDRESS);
    console.log('🔗 BaseScan:', `https://basescan.org/address/${process.env.CONTRACT_ADDRESS}`);
    console.log('🔗 Your Wallet:', `https://basescan.org/address/${wallet.address}`);
}

manualEmergency();
