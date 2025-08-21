// Emergency Stop Script for CryptoBot
require('dotenv').config();
const { ethers } = require('ethers');

async function emergencyStop() {
    console.log('🚨 EMERGENCY STOP INITIATED');
    
    // Check environment
    if (!process.env.WALLET_KEY || !process.env.CONTRACT_ADDRESS) {
        console.error('❌ Missing WALLET_KEY or CONTRACT_ADDRESS in .env');
        return;
    }
    
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_KEY, provider);
    
    const contractABI = [
        'function pause() external',
        'function unpause() external', 
        'function toggleEmergencyStop() external',
        'function emergencyStop() view returns (bool)',
        'function paused() view returns (bool)',
        'function withdrawToken(address token, uint256 amount) external',
        'function withdrawETH() external',
        'function getTokenBalance(address token) view returns (uint256)',
        'function getETHBalance() view returns (uint256)',
        'function owner() view returns (address)'
    ];
    
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
    
    try {
        console.log('📋 Current Contract Status:');
        console.log(`   Paused: ${await contract.paused()}`);
        console.log(`   Emergency Stop: ${await contract.emergencyStop()}`);
        console.log(`   Owner: ${await contract.owner()}`);
        console.log(`   Your Address: ${wallet.address}`);
        
        // Check if you're the owner
        const owner = await contract.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error('❌ You are not the contract owner!');
            return;
        }
        
        console.log('\n🛑 Executing Emergency Stop...');
        
        // 1. Pause the contract
        console.log('⏸️  Pausing contract...');
        const pauseTx = await contract.pause();
        console.log(`📝 Pause TX: ${pauseTx.hash}`);
        await pauseTx.wait();
        console.log('✅ Contract paused');
        
        // 2. Toggle emergency stop
        console.log('🚨 Activating emergency stop...');
        const emergencyTx = await contract.toggleEmergencyStop();
        console.log(`📝 Emergency Stop TX: ${emergencyTx.hash}`);
        await emergencyTx.wait();
        console.log('✅ Emergency stop activated');
        
        console.log('\n🎯 Emergency Stop Complete!');
        console.log('   - Contract is now paused');
        console.log('   - Emergency stop is active');
        console.log('   - No further arbitrage can be executed');
        
    } catch (error) {
        console.error('❌ Emergency stop failed:', error.message);
        console.log('💡 Try manual steps in the emergency guide');
    }
}

// Run emergency stop
emergencyStop().catch(console.error);
