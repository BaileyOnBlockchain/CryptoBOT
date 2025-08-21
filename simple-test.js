// Simple test for environment variables
console.log('=== SIMPLE ENV TEST ===');

// Method 1: Direct require
try {
    require('dotenv').config();
    console.log('✅ dotenv loaded');
} catch (e) {
    console.log('❌ dotenv failed:', e.message);
}

// Method 2: Check variables
console.log('\nEnvironment variables:');
console.log('WALLET_KEY exists:', !!process.env.WALLET_KEY);
console.log('CONTRACT_ADDRESS exists:', !!process.env.CONTRACT_ADDRESS);

if (process.env.WALLET_KEY) {
    console.log('WALLET_KEY length:', process.env.WALLET_KEY.length);
}
if (process.env.CONTRACT_ADDRESS) {
    console.log('CONTRACT_ADDRESS length:', process.env.CONTRACT_ADDRESS.length);
}

// Method 3: Try manual file reading
const fs = require('fs');
try {
    const envContent = fs.readFileSync('.env', 'utf8');
    console.log('\n📄 .env file content:');
    console.log(envContent);
} catch (e) {
    console.log('❌ File read failed:', e.message);
}
