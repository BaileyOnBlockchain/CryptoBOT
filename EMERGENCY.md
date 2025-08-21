# 🚨 EMERGENCY PROCEDURES - CryptoBot

## ⚡ IMMEDIATE ACTIONS (30 seconds)

### 🛑 **STEP 1: STOP THE BOT**
```bash
# Press Ctrl+C in the terminal running the bot
Ctrl + C
```

### 📊 **STEP 2: CHECK STATUS**
```bash
npm run emergency:status
```

### 🔒 **STEP 3: EMERGENCY STOP CONTRACT**
```bash
npm run emergency:stop
```

## 🆘 EMERGENCY SCENARIOS

### 🔴 **CRITICAL: Bot Making Losing Trades**
```bash
# 1. Stop bot immediately
Ctrl + C

# 2. Stop contract
npm run emergency:stop

# 3. Withdraw all funds
npm run emergency:withdraw

# 4. Check status
npm run emergency:status
```

### 🟠 **HIGH: Unusual Behavior Detected**
```bash
# 1. Stop bot
Ctrl + C

# 2. Check what's happening
npm run emergency:status

# 3. If needed, stop contract
npm run emergency:stop
```

### 🟡 **MEDIUM: High Gas Costs**
```bash
# 1. Stop bot temporarily
Ctrl + C

# 2. Wait for gas to decrease
# 3. Monitor gas on https://basescan.org/gastracker

# 4. Restart when gas is acceptable
npm start
```

### 🟢 **LOW: System Monitoring**
```bash
# Check status regularly
npm run emergency:status
```

## 📋 EMERGENCY COMMANDS

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run emergency:status` | Check contract status | Always first step |
| `npm run emergency:stop` | Pause contract & emergency stop | When bot misbehaving |
| `npm run emergency:withdraw` | Withdraw all funds | Critical situations |
| `npm run emergency:manual` | Manual emergency info | If scripts fail |

## 🔍 TROUBLESHOOTING

### **Script Fails: "Not the owner"**
- Check your WALLET_KEY in .env
- Verify you deployed the contract with this wallet

### **Script Fails: "Insufficient funds"**
- You need ETH for gas fees
- Contract might already be empty

### **Script Fails: "Execution reverted"**
- Contract might already be paused
- Try `npm run emergency:status` first

### **Can't Connect to Contract**
- Check CONTRACT_ADDRESS in .env
- Verify network connection
- Check if contract exists on BaseScan

## 🌐 MANUAL BACKUP PROCEDURES

If all scripts fail, use BaseScan directly:

1. **Go to:** https://basescan.org/address/YOUR_CONTRACT_ADDRESS
2. **Click:** "Contract" tab → "Write Contract"
3. **Connect:** Your wallet
4. **Execute:**
   - `pause()` - Stops all operations
   - `toggleEmergencyStop()` - Activates emergency mode
   - `withdrawToken()` - Withdraws specific tokens
   - `withdrawETH()` - Withdraws ETH

## 📱 EMERGENCY CONTACTS

### **Contract Information**
- **Contract Address:** Check your .env file
- **BaseScan:** https://basescan.org/address/YOUR_CONTRACT_ADDRESS
- **Your Wallet:** https://basescan.org/address/YOUR_WALLET_ADDRESS

### **Network Information**
- **Base Mainnet RPC:** https://mainnet.base.org
- **Gas Tracker:** https://basescan.org/gastracker
- **Block Explorer:** https://basescan.org/

## ⚠️ PREVENTION TIPS

### **Before Each Run:**
1. Check `npm run emergency:status`
2. Verify sufficient ETH for gas
3. Monitor gas prices
4. Set appropriate profit thresholds

### **During Operation:**
1. Monitor logs for errors
2. Check BaseScan for transactions
3. Watch for unusual patterns
4. Keep terminal visible

### **Regular Maintenance:**
1. Run `npm run emergency:status` daily
2. Check wallet balances
3. Monitor contract events
4. Update profit thresholds as needed

## 🔒 SECURITY REMINDERS

- **Never share your private key**
- **Keep emergency scripts handy**
- **Test emergency procedures on testnet**
- **Have sufficient ETH for emergency transactions**
- **Know your contract address by heart**
- **Bookmark BaseScan contract page**

---

## 🎯 QUICK REFERENCE

```bash
# Status check (always run first)
npm run emergency:status

# Emergency stop (stops all operations)
npm run emergency:stop

# Emergency withdrawal (gets your funds back)
npm run emergency:withdraw

# Manual commands (if scripts fail)
npm run emergency:manual
```

**Remember: In emergencies, speed matters. Practice these commands before you need them!**
