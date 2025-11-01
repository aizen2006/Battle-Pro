const hre = require("hardhat");

async function main() {
  const BattleCard = await hre.ethers.getContractFactory("BattleCard");
  const card = await BattleCard.deploy();
  await card.waitForDeployment();
  console.log("BattleCard deployed to:", await card.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
