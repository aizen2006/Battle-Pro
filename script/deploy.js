const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy BattleCard
  console.log("\nDeploying BattleCard...");
  const BattleCard = await hre.ethers.getContractFactory("BattleCard");
  const battleCard = await BattleCard.deploy();
  await battleCard.waitForDeployment();
  const battleCardAddress = await battleCard.getAddress();
  console.log("BattleCard deployed to:", battleCardAddress);

  // Deploy BattleManager
  console.log("\nDeploying BattleManager...");
  const BattleManager = await hre.ethers.getContractFactory("BattleManager");
  const battleManager = await BattleManager.deploy(battleCardAddress);
  await battleManager.waitForDeployment();
  const battleManagerAddress = await battleManager.getAddress();
  console.log("BattleManager deployed to:", battleManagerAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("BattleCard:", battleCardAddress);
  console.log("BattleManager:", battleManagerAddress);
  console.log("\nAdd these addresses to your frontend .env file:");
  console.log(`REACT_APP_BATTLE_CARD_ADDRESS=${battleCardAddress}`);
  console.log(`REACT_APP_BATTLE_MANAGER_ADDRESS=${battleManagerAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });