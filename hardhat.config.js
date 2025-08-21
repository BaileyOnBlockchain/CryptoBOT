require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    "base-mainnet": {
      url: "https://mainnet.base.org",
      accounts: [process.env.WALLET_KEY],
      gasPrice: 1000000000,
    },
    "base-sepolia": {
      url: "https://sepolia.base.org",
      accounts: [process.env.WALLET_KEY],
      gasPrice: 1000000000,
    },
    "arbitrum": {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.WALLET_KEY],
    },
    "arbitrum-sepolia": {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: [process.env.WALLET_KEY],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};