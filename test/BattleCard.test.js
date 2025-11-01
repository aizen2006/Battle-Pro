const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BattleCard", function () {
  let battleCard;
  let owner;
  let user1;
  let user2;

  const MINT_FEE = ethers.parseEther("0.001");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const BattleCard = await ethers.getContractFactory("BattleCard");
    battleCard = await BattleCard.deploy();
    await battleCard.waitForDeployment();
  });

  describe("Minting", function () {
    it("Should mint a card with correct fee", async function () {
      await expect(battleCard.connect(user1).mintCard({ value: MINT_FEE }))
        .to.emit(battleCard, "CardMinted")
        .withArgs(user1.address, 1, ...ethers.getAddress(ethers.zeroPadValue("0x00", 20)));
      
      expect(await battleCard.ownerOf(1)).to.equal(user1.address);
      expect(await battleCard.nextId()).to.equal(2n);
    });

    it("Should reject minting with incorrect fee", async function () {
      await expect(
        battleCard.connect(user1).mintCard({ value: ethers.parseEther("0.0005") })
      ).to.be.revertedWith("Incorrect mint fee");
    });

    it("Should generate card attributes", async function () {
      await battleCard.connect(user1).mintCard({ value: MINT_FEE });
      const card = await battleCard.getCard(1);
      
      expect(card.power).to.be.greaterThan(0);
      expect(card.defense).to.be.greaterThan(0);
      expect(card.speed).to.be.greaterThan(0);
      expect(card.rarity).to.be.within(0, 4);
      expect(card.character).to.be.within(0, 3);
    });

    it("Should track owned tokens", async function () {
      await battleCard.connect(user1).mintCard({ value: MINT_FEE });
      await battleCard.connect(user1).mintCard({ value: MINT_FEE });
      
      const tokens = await battleCard.getOwnedTokens(user1.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(1n);
      expect(tokens[1]).to.equal(2n);
    });
  });

  describe("Withdrawal", function () {
    it("Should allow owner to withdraw mint fees", async function () {
      await battleCard.connect(user1).mintCard({ value: MINT_FEE });
      await battleCard.connect(user2).mintCard({ value: MINT_FEE });
      
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await battleCard.connect(owner).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      
      expect(balanceAfter).to.be.greaterThan(balanceBefore - gasUsed + MINT_FEE * 2n - ethers.parseEther("0.0001"));
    });
  });
});

describe("BattleManager", function () {
  let battleCard;
  let battleManager;
  let owner;
  let user1;
  let user2;

  const MINT_FEE = ethers.parseEther("0.001");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const BattleCard = await ethers.getContractFactory("BattleCard");
    battleCard = await BattleCard.deploy();
    await battleCard.waitForDeployment();
    const battleCardAddress = await battleCard.getAddress();

    const BattleManager = await ethers.getContractFactory("BattleManager");
    battleManager = await BattleManager.deploy(battleCardAddress);
    await battleManager.waitForDeployment();

    // Mint cards for testing
    for (let i = 0; i < 3; i++) {
      await battleCard.connect(user1).mintCard({ value: MINT_FEE });
      await battleCard.connect(user2).mintCard({ value: MINT_FEE });
    }
  });

  describe("Battle Flow", function () {
    it("Should create a battle", async function () {
      const myCards = [1, 2, 3];
      await battleCard.connect(user1).batchApprove(await battleManager.getAddress(), myCards);
      
      await expect(battleManager.connect(user1).createBattle(user2.address, myCards))
        .to.emit(battleManager, "BattleCreated");
      
      const battle = await battleManager.getBattle(0);
      expect(battle.starter).to.equal(user1.address);
      expect(battle.opponent).to.equal(user2.address);
      expect(battle.status).to.equal(0); // WaitingForOpponent
    });

    it("Should join a battle", async function () {
      const myCards = [1, 2, 3];
      await battleCard.connect(user1).batchApprove(await battleManager.getAddress(), myCards);
      await battleManager.connect(user1).createBattle(user2.address, myCards);
      
      const opponentCards = [4, 5, 6];
      await battleCard.connect(user2).batchApprove(await battleManager.getAddress(), opponentCards);
      
      await expect(battleManager.connect(user2).joinBattle(0, opponentCards))
        .to.emit(battleManager, "BattleJoined");
      
      const battle = await battleManager.getBattle(0);
      expect(battle.status).to.equal(1); // ReadyToReveal
    });

    it("Should resolve rounds and determine winner", async function () {
      const myCards = [1, 2, 3];
      await battleCard.connect(user1).batchApprove(await battleManager.getAddress(), myCards);
      await battleManager.connect(user1).createBattle(user2.address, myCards);
      
      const opponentCards = [4, 5, 6];
      await battleCard.connect(user2).batchApprove(await battleManager.getAddress(), opponentCards);
      await battleManager.connect(user2).joinBattle(0, opponentCards);
      
      // Reveal all rounds
      for (let i = 0; i < 3; i++) {
        await battleManager.revealRound(0);
      }
      
      const battle = await battleManager.getBattle(0);
      expect(battle.status).to.equal(3); // Resolved
      expect(battle.winner).to.not.equal(ethers.ZeroAddress);
    });

    it("Should allow winner to claim reward", async function () {
      const myCards = [1, 2, 3];
      await battleCard.connect(user1).batchApprove(await battleManager.getAddress(), myCards);
      await battleManager.connect(user1).createBattle(user2.address, myCards);
      
      const opponentCards = [4, 5, 6];
      await battleCard.connect(user2).batchApprove(await battleManager.getAddress(), opponentCards);
      await battleManager.connect(user2).joinBattle(0, opponentCards);
      
      // Reveal all rounds
      for (let i = 0; i < 3; i++) {
        await battleManager.revealRound(0);
      }
      
      const battle = await battleManager.getBattle(0);
      const winner = battle.winner === user1.address ? user1 : user2;
      
      await battleManager.connect(winner).claimReward(0, 0);
      
      // Check that prize card was transferred to winner
      const prizeOwner = await battleCard.ownerOf(battle.opponentCards[0]);
      expect(prizeOwner).to.equal(winner.address);
    });
  });
});
