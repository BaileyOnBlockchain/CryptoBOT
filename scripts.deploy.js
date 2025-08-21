const { ethers } = require("hardhat");

async function main() {
  const Factory = await ethers.getContractFactory("FlashLoanArbitrage");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  console.log(`Deployed: ${contract.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});