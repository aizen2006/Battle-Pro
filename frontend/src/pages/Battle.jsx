import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import Card from "../components/Card";
import {
  getBattleCardContract,
  getBattleManagerContract,
  getProvider,
  formatAddress,
} from "../lib/ethereum";

const BATTLE_STATUS = {
  0: "Waiting for Opponent",
  1: "Ready to Reveal",
  2: "In Progress",
  3: "Resolved",
  4: "Cancelled",
};

export default function Battle({ account }) {
  const [userCards, setUserCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [mode, setMode] = useState("create"); // "create" or "join"
  const [opponentAddress, setOpponentAddress] = useState("");
  const [battleId, setBattleId] = useState("");
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [battleCards, setBattleCards] = useState({}); // Maps tokenId to card data
  const [revealedRounds, setRevealedRounds] = useState([]); // Array of {round, starterCard, opponentCard, starterWon}
  const [historyMode, setHistoryMode] = useState(false); // Toggle between current battle and history
  const [battleHistory, setBattleHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all"); // "all", "wins", "losses"

  useEffect(() => {
    if (account) {
      loadUserCards();
    }
  }, [account]);

  useEffect(() => {
    if (battleId && account) {
      loadBattle();
      // Poll battle data every 3 seconds to keep it updated
      const interval = setInterval(() => {
        loadBattle();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [battleId, account]);

  const loadUserCards = async () => {
    if (!account) return;
    try {
      const contract = await getBattleCardContract();
      if (!contract) return;

      // Debug: Check network and account
      const provider = getProvider();
      if (!provider) {
        console.error("❌ Provider not available");
        return;
      }

      const network = await provider.getNetwork();
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const signerLower = signerAddress.toLowerCase();
      
      console.log("🌐 Network:", {
        chainId: network.chainId.toString(),
        name: network.name,
        account: account,
        signerAddress: signerAddress,
        match: account.toLowerCase() === signerLower,
      });

      // Get balance first (using signer address)
      const balance = await contract.balanceOf(signerAddress);
      console.log(`📊 Your balance: ${balance.toString()} cards`);

      if (Number(balance) === 0) {
        console.log("✅ No cards owned");
        setUserCards([]);
        return;
      }

      // Get next token ID to know the range
      const nextId = await contract.nextId();
      const nextIdNum = Number(nextId);
      console.log(`📋 Next token ID: ${nextIdNum} (checking tokens 1-${nextIdNum - 1})`);

      // Iterate through all possible token IDs and check ownership directly
      // This uses ownerOf() as the source of truth, avoiding stale data from getOwnedTokens
      const ownedCards = [];
      
      // Check tokens in batches to avoid too many calls at once
      const batchSize = 10;
      for (let startId = 1; startId < nextIdNum; startId += batchSize) {
        const endId = Math.min(startId + batchSize, nextIdNum);
        const batchPromises = [];
        
        for (let i = startId; i < endId; i++) {
          batchPromises.push(
            (async () => {
              try {
                // Check ownership directly - ownerOf is the source of truth
                const owner = await contract.ownerOf(i);
                if (owner.toLowerCase() === signerLower) {
                  // This card is owned by the user
                  const cardData = await contract.getCard(i);
                  return {
                    tokenId: i.toString(),
                    power: Number(cardData.power) || 0,
                    defense: Number(cardData.defense) || 0,
                    speed: Number(cardData.speed) || 0,
                    character: Number(cardData.character) || 0,
                    rarity: Number(cardData.rarity) || 0,
                  };
                }
              } catch (error) {
                // Token doesn't exist or error checking - skip it
                return null;
              }
              return null;
            })()
          );
        }
        
        const batchResults = await Promise.all(batchPromises);
        const validBatchCards = batchResults.filter((c) => c !== null);
        ownedCards.push(...validBatchCards);
        
        console.log(`🔍 Checked tokens ${startId}-${endId - 1}, found ${validBatchCards.length} owned cards`);
      }

      console.log(`✅ Loaded ${ownedCards.length} cards you actually own (verified via ownerOf)`);
      setUserCards(ownedCards);
    } catch (error) {
      console.error("❌ Error loading cards:", error);
    }
  };

  const loadBattle = async () => {
    if (!battleId) return;
    try {
      const managerContract = await getBattleManagerContract();
      if (!managerContract) return;

      const battleData = await managerContract.getBattle(battleId);
      // Convert BigInt values to numbers for display and comparison
      const battleState = {
        starter: battleData.starter,
        opponent: battleData.opponent,
        starterCards: battleData.starterCards.map((id) => id.toString()),
        opponentCards: battleData.opponentCards.map((id) => id.toString()),
        starterWins: Number(battleData.starterWins) || 0,
        opponentWins: Number(battleData.opponentWins) || 0,
        currentRound: Number(battleData.currentRound) || 0,
        status: Number(battleData.status) || 0,
        winner: battleData.winner,
        createdAt: Number(battleData.createdAt) || 0,
      };
      setBattle(battleState);
      
      // Load card data for this battle
      if (battleState.status >= 1 && battleState.status <= 3) {
        await loadBattleCards(battleState);
        await loadRoundHistory(battleId);
      }
    } catch (error) {
      console.error("Error loading battle:", error);
    }
  };

  const loadBattleCards = async (battleData) => {
    if (!battleData) return;
    
    try {
      const contract = await getBattleCardContract();
      if (!contract) return;
      
      const cards = {};
      const allCardIds = [...battleData.starterCards, ...battleData.opponentCards];
      
      // Load all 6 cards
      for (const cardId of allCardIds) {
        if (cardId && cardId !== "0") {
          try {
            const cardData = await contract.getCard(cardId);
            cards[cardId] = {
              tokenId: cardId.toString(),
              power: Number(cardData.power) || 0,
              defense: Number(cardData.defense) || 0,
              speed: Number(cardData.speed) || 0,
              character: Number(cardData.character) || 0,
              rarity: Number(cardData.rarity) || 0,
            };
          } catch (error) {
            console.error(`Error loading card ${cardId}:`, error);
          }
        }
      }
      
      setBattleCards(cards);
    } catch (error) {
      console.error("Error loading battle cards:", error);
    }
  };

  const loadRoundHistory = async (battleIdNum) => {
    try {
      const managerContract = await getBattleManagerContract();
      if (!managerContract) return;
      
      const provider = getProvider();
      if (!provider) return;
      
      // Query RoundResolved events for this battle
      const filter = managerContract.filters.RoundResolved(battleIdNum);
      const events = await managerContract.queryFilter(filter);
      
      const rounds = events.map((event) => ({
        round: Number(event.args.roundIndex),
        starterCard: event.args.starterCardId.toString(),
        opponentCard: event.args.opponentCardId.toString(),
        starterWon: event.args.starterWon,
      }));
      
      // Sort by round number
      rounds.sort((a, b) => a.round - b.round);
      setRevealedRounds(rounds);
    } catch (error) {
      console.error("Error loading round history:", error);
    }
  };

  const toggleCardSelection = (tokenId) => {
    // Verify that the card is actually in the user's cards list (owned)
    const cardExists = userCards.some((card) => card.tokenId === tokenId);
    if (!cardExists) {
      console.warn(`Card #${tokenId} is not in your owned cards list. Cannot select.`);
      alert(`Cannot select card #${tokenId}. Make sure you own this card.`);
      return;
    }

    setSelectedCards((prev) => {
      if (prev.includes(tokenId)) {
        return prev.filter((id) => id !== tokenId);
      } else {
        if (prev.length >= 3) {
          alert("You can only select 3 cards for battle");
          return prev;
        }
        return [...prev, tokenId];
      }
    });
  };

  const createBattle = async () => {
    if (!account || selectedCards.length !== 3 || !opponentAddress) {
      alert("Please select exactly 3 cards and enter opponent address");
      return;
    }

    setLoading(true);
    try {
      // Validate and checksum the opponent address
      let checksummedOpponentAddress;
      try {
        checksummedOpponentAddress = ethers.getAddress(opponentAddress);
      } catch (e) {
        alert(`Invalid opponent address: ${e.message}`);
        setLoading(false);
        return;
      }

      const battleCardContract = await getBattleCardContract();
      const managerContract = await getBattleManagerContract();
      if (!battleCardContract || !managerContract) {
        throw new Error("Contracts not available");
      }

      // Convert card IDs to proper format (uint256[])
      // The contract expects uint256[3], ethers.js will convert the array automatically
      const cardIds = [
        selectedCards[0],
        selectedCards[1],
        selectedCards[2]
      ];

      // Get the actual signer address (the one making the transaction)
      const provider = getProvider();
      if (!provider) throw new Error("Provider not available");
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const signerLower = signerAddress.toLowerCase();
      
      console.log("🔍 Verifying ownership before creating battle:");
      console.log("  Selected cards:", selectedCards);
      console.log("  Account prop:", account);
      console.log("  Signer address:", signerAddress);
      console.log("  Match:", account.toLowerCase() === signerLower);

      // Verify ownership of selected cards first (for better error messages)
      const unownedCards = [];
      const { BATTLE_MANAGER_ADDRESS } = await import("../lib/ethereum");
      const managerAddrCreate = BATTLE_MANAGER_ADDRESS?.toLowerCase();
      
      for (let i = 0; i < selectedCards.length; i++) {
        const cardId = selectedCards[i];
        try {
          // ownerOf accepts uint256, ethers.js will convert string/number automatically
          const owner = await battleCardContract.ownerOf(cardId);
          const ownerLower = owner.toLowerCase();
          
          console.log(`  Card #${cardId}: owner=${owner}, signer=${signerAddress}, match=${ownerLower === signerLower}`);
          
          // Use signer address for verification (the one actually making the transaction)
          if (ownerLower !== signerLower) {
            // Check if card is in BattleManager escrow
            const isInBattle = ownerLower === managerAddrCreate;
            unownedCards.push({ 
              cardId, 
              owner, 
              signer: signerAddress,
              isInBattle 
            });
            
            if (isInBattle) {
              console.error(`❌ Card #${cardId} is currently in an active battle (escrowed with BattleManager). Please wait for the battle to complete.`);
            } else {
              console.error(`❌ Card #${cardId} is not owned by signer ${signerAddress}. Owner: ${owner}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error checking ownership of card ${cardId}:`, error);
          unownedCards.push({ cardId, error: error.message });
        }
      }
      
      // If any cards are not owned, throw error with details
      if (unownedCards.length > 0) {
        const inBattleCards = unownedCards.filter(c => c.isInBattle);
        const otherCards = unownedCards.filter(c => !c.isInBattle);
        
        let errorMsg = "You don't own the following cards: ";
        if (inBattleCards.length > 0) {
          errorMsg += `Cards ${inBattleCards.map(c => `#${c.cardId}`).join(', ')} are currently in an active battle. `;
        }
        if (otherCards.length > 0) {
          errorMsg += `Cards ${otherCards.map(c => `#${c.cardId}`).join(', ')} are owned by other addresses. `;
        }
        errorMsg += "Please select only cards you actually own and that are not in battles.";
        
        throw new Error(errorMsg);
      }
      
      console.log("✅ All cards verified. Checking approval status...");

      // Check and approve BattleManager if needed (saves gas if already approved)
      // Use the same BATTLE_MANAGER_ADDRESS imported earlier
      const approvalsNeeded = [];
      const checksummedManagerCreate = ethers.getAddress(BATTLE_MANAGER_ADDRESS);
      
      for (const tokenId of cardIds) {
        try {
          const approvedAddress = await battleCardContract.getApproved(tokenId);
          const approvedLower = approvedAddress?.toLowerCase() || "";
          const managerLower = checksummedManagerCreate.toLowerCase();
          
          if (approvedLower !== managerLower) {
            approvalsNeeded.push(tokenId);
            console.log(`Card #${tokenId} needs approval (current: ${approvedAddress || 'none'})`);
          } else {
            console.log(`Card #${tokenId} already approved ✓`);
          }
        } catch (error) {
          console.warn(`Error checking approval for card #${tokenId}:`, error);
          // If we can't check, assume approval is needed (safer)
          approvalsNeeded.push(tokenId);
        }
      }
      
      // Only call batchApprove if approvals are needed
      if (approvalsNeeded.length > 0) {
        console.log(`📝 Approving ${approvalsNeeded.length} cards for BattleManager...`);
        const approveTx = await battleCardContract.batchApprove(checksummedManagerCreate, approvalsNeeded);
        await approveTx.wait();
        console.log(`✅ Approved ${approvalsNeeded.length} cards`);
      } else {
        console.log(`✅ All cards already approved - saving gas!`);
      }

      // Create battle with checksummed address
      // Now that BattleManager is approved, transferFrom will succeed
      const tx = await managerContract.createBattle(checksummedOpponentAddress, cardIds);
      const receipt = await tx.wait();

      // Extract battle ID from events
      const event = receipt.logs.find(
        (log) =>
          log.topics[0] ===
          managerContract.interface.getEvent("BattleCreated").topicHash
      );
      if (event) {
        const parsed = managerContract.interface.parseLog(event);
        const newBattleId = parsed.args.battleId;
        setBattleId(newBattleId.toString());
        // Automatically load battle data after creation
        await loadBattle();
        alert(`Battle created! Battle ID: ${newBattleId}`);
      } else {
        // Fallback: reload battle if event not found
        setTimeout(() => loadBattle(), 2000);
      }
    } catch (error) {
      console.error("❌ Error creating battle:", error);
      
      // Try to decode the revert reason if available
      let errorMessage = error.message || "Unknown error";
      
      // Check for specific error patterns
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.data) {
        // Try to decode custom error data
        try {
          // The error data might contain encoded information
          console.error("Error data:", error.data);
          // Check if it's a "Not owner" error
          if (error.data.toString().includes("177e802f") || error.message.includes("Not owner")) {
            errorMessage = "One or more cards are not owned by you. Please select cards you actually own.";
          }
        } catch (e) {
          console.error("Failed to decode error data:", e);
        }
      }
      
      // Check for common ownership errors
      if (errorMessage.includes("Not owner") || errorMessage.includes("don't own") || errorMessage.includes("don't own")) {
        // Clear selected cards and reload to refresh the list
        setSelectedCards([]);
        await loadUserCards();
        alert(`Failed to create battle: ${errorMessage}\n\nYour card list has been refreshed. Please select only cards you own.`);
      } else {
        alert(`Failed to create battle: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const joinBattle = async () => {
    if (!account || selectedCards.length !== 3 || !battleId) {
      alert("Please select exactly 3 cards and enter battle ID");
      return;
    }

    setLoading(true);
    try {
      const battleCardContract = await getBattleCardContract();
      const managerContract = await getBattleManagerContract();
      if (!battleCardContract || !managerContract) {
        throw new Error("Contracts not available");
      }

      // Convert card IDs to proper format (uint256)
      // The contract expects a fixed-size array of 3 uint256
      // selectedCards are strings, convert to numbers for contract call
      const cardIds = [
        selectedCards[0],
        selectedCards[1],
        selectedCards[2]
      ];
      
      // Get the actual signer address (the one making the transaction)
      const provider = getProvider();
      if (!provider) throw new Error("Provider not available");
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const signerLower = signerAddress.toLowerCase();
      
      console.log("🔍 Verifying ownership before joining battle:");
      console.log("  Selected cards:", selectedCards);
      console.log("  Account prop:", account);
      console.log("  Signer address:", signerAddress);
      console.log("  Match:", account.toLowerCase() === signerLower);

      // Verify ownership of selected cards first (for better error messages)
      const unownedCards = [];
      const { BATTLE_MANAGER_ADDRESS } = await import("../lib/ethereum");
      const managerAddrCreate = BATTLE_MANAGER_ADDRESS?.toLowerCase();
      
      for (let i = 0; i < selectedCards.length; i++) {
        const cardId = selectedCards[i];
        try {
          // ownerOf accepts uint256, ethers.js will convert string/number automatically
          const owner = await battleCardContract.ownerOf(cardId);
          const ownerLower = owner.toLowerCase();
          
          console.log(`  Card #${cardId}: owner=${owner}, signer=${signerAddress}, match=${ownerLower === signerLower}`);
          
          // Use signer address for verification (the one actually making the transaction)
          if (ownerLower !== signerLower) {
            // Check if card is in BattleManager escrow
            const isInBattle = ownerLower === managerAddrCreate;
            unownedCards.push({ 
              cardId, 
              owner, 
              signer: signerAddress,
              isInBattle 
            });
            
            if (isInBattle) {
              console.error(`❌ Card #${cardId} is currently in an active battle (escrowed with BattleManager). Please wait for the battle to complete.`);
            } else {
              console.error(`❌ Card #${cardId} is not owned by signer ${signerAddress}. Owner: ${owner}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error checking ownership of card ${cardId}:`, error);
          unownedCards.push({ cardId, error: error.message });
        }
      }
      
      // If any cards are not owned, throw error with details
      if (unownedCards.length > 0) {
        const inBattleCards = unownedCards.filter(c => c.isInBattle);
        const otherCards = unownedCards.filter(c => !c.isInBattle);
        
        let errorMsg = "You don't own the following cards: ";
        if (inBattleCards.length > 0) {
          errorMsg += `Cards ${inBattleCards.map(c => `#${c.cardId}`).join(', ')} are currently in an active battle. `;
        }
        if (otherCards.length > 0) {
          errorMsg += `Cards ${otherCards.map(c => `#${c.cardId}`).join(', ')} are owned by other addresses. `;
        }
        errorMsg += "Please select only cards you actually own and that are not in battles.";
        
        throw new Error(errorMsg);
      }
      
      console.log("✅ All cards verified. Checking approval status...");

      // Check and approve BattleManager if needed (saves gas if already approved)
      const { BATTLE_MANAGER_ADDRESS: BATTLE_MANAGER_JOIN } = await import("../lib/ethereum");
      const approvalsNeeded = [];
      const checksummedManagerJoin = ethers.getAddress(BATTLE_MANAGER_JOIN);
      
      for (const tokenId of cardIds) {
        try {
          const approvedAddress = await battleCardContract.getApproved(tokenId);
          const approvedLower = approvedAddress?.toLowerCase() || "";
          const managerLower = checksummedManagerJoin.toLowerCase();
          
          if (approvedLower !== managerLower) {
            approvalsNeeded.push(tokenId);
            console.log(`Card #${tokenId} needs approval (current: ${approvedAddress || 'none'})`);
          } else {
            console.log(`Card #${tokenId} already approved ✓`);
          }
        } catch (error) {
          console.warn(`Error checking approval for card #${tokenId}:`, error);
          // If we can't check, assume approval is needed (safer)
          approvalsNeeded.push(tokenId);
        }
      }
      
      // Only call batchApprove if approvals are needed
      if (approvalsNeeded.length > 0) {
        console.log(`📝 Approving ${approvalsNeeded.length} cards for BattleManager...`);
        const approveTx = await battleCardContract.batchApprove(checksummedManagerJoin, approvalsNeeded);
        await approveTx.wait();
        console.log(`✅ Approved ${approvalsNeeded.length} cards`);
      } else {
        console.log(`✅ All cards already approved - saving gas!`);
      }
      
      // Convert battleId to number/string for the contract call
      const battleIdNum = typeof battleId === 'string' ? battleId : battleId.toString();
      
      // Join battle - contract expects uint256[3], ethers.js will convert our array
      // Now that BattleManager is approved, transferFrom will succeed
      const tx = await managerContract.joinBattle(battleIdNum, cardIds);
      await tx.wait();

      alert("Battle joined successfully!");
      // Reload battle data to show the battle view
      await loadBattle();
      
      // Switch to showing the battle view (status should be ReadyToReveal now)
    } catch (error) {
      console.error("❌ Error joining battle:", error);
      
      // Try to decode the revert reason if available
      let errorMessage = error.message || "Unknown error";
      
      // Check for specific error patterns
      if (error.reason) {
        errorMessage = error.reason;
      }
      
      // Check for common ownership errors
      if (errorMessage.includes("Not owner") || errorMessage.includes("don't own")) {
        // Clear selected cards and reload to refresh the list
        setSelectedCards([]);
        await loadUserCards();
        alert(`Failed to join battle: ${errorMessage}\n\nYour card list has been refreshed. Please select only cards you own.`);
      } else {
        alert(`Failed to join battle: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const revealRound = async () => {
    if (!battleId) return;
    setLoading(true);
    try {
      const managerContract = await getBattleManagerContract();
      if (!managerContract) throw new Error("Contract not available");

      // Convert battleId to number if it's a string
      const battleIdNum = typeof battleId === 'string' ? battleId : battleId.toString();
      const tx = await managerContract.revealRound(battleIdNum);
      await tx.wait();
      
      // Wait a bit for state to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload battle data after revealing round
      await loadBattle();
    } catch (error) {
      console.error("Error revealing round:", error);
      alert(`Failed to reveal round: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (prizeIndex) => {
    if (!battleId || prizeIndex === undefined) return;
    setLoading(true);
    try {
      const managerContract = await getBattleManagerContract();
      if (!managerContract) throw new Error("Contract not available");

      const tx = await managerContract.claimReward(battleId, prizeIndex);
      const receipt = await tx.wait();
      
      console.log("✅ Reward claimed! Transaction:", receipt.hash);
      
      // Wait longer for blockchain state to propagate (increased from 2s to 3s)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Clear battle state to hide battle view and force refresh
      setBattle(null);
      setBattleId("");
      setBattleCards({});
      setRevealedRounds([]);
      
      // Add explicit delay before reloading user cards to ensure blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload user cards to reflect the transfer
      await loadUserCards();
      
      // Verify card ownership after refresh (optional verification)
      const battleCardContract = await getBattleCardContract();
      if (battleCardContract && battle) {
        try {
          const claimedCardId = battle.opponentCards[prizeIndex];
          if (claimedCardId && claimedCardId !== "0") {
            const owner = await battleCardContract.ownerOf(claimedCardId);
            const userAddress = account.toLowerCase();
            console.log(`Card #${claimedCardId} owner after claim: ${owner}, user: ${account}`);
            if (owner.toLowerCase() === userAddress) {
              console.log("✅ Card ownership verified!");
            }
          }
        } catch (error) {
          console.warn("Could not verify card ownership:", error);
        }
      }
      
      // Show success message and close battle view
      alert("Reward claimed successfully! Your cards have been updated.");
    } catch (error) {
      console.error("Error claiming reward:", error);
      alert(`Failed to claim reward: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadBattleHistory = async () => {
    if (!account) return;
    setLoading(true);
    try {
      const managerContract = await getBattleManagerContract();
      if (!managerContract) return;
      
      const provider = getProvider();
      if (!provider) return;
      
      const userAddress = account.toLowerCase();
      
      // Query events where user is starter
      const starterFilter = managerContract.filters.BattleCreated(null, null, null);
      const starterEvents = await managerContract.queryFilter(starterFilter);
      
      // Query events where user is opponent
      const opponentFilter = managerContract.filters.BattleJoined(null, null);
      const opponentEvents = await managerContract.queryFilter(opponentFilter);
      
      // Collect unique battle IDs
      const battleIdSet = new Set();
      
      starterEvents.forEach(event => {
        if (event.args.starter.toLowerCase() === userAddress) {
          battleIdSet.add(event.args.battleId.toString());
        }
      });
      
      opponentEvents.forEach(event => {
        if (event.args.opponent.toLowerCase() === userAddress) {
          battleIdSet.add(event.args.battleId.toString());
        }
      });
      
      // Load battle data for each battle
      const history = [];
      const battleCardContract = await getBattleCardContract();
      
      for (const id of Array.from(battleIdSet)) {
        try {
          const battleData = await managerContract.getBattle(id);
          const battleState = {
            battleId: id,
            starter: battleData.starter,
            opponent: battleData.opponent,
            starterCards: battleData.starterCards.map((cid) => cid.toString()),
            opponentCards: battleData.opponentCards.map((cid) => cid.toString()),
            starterWins: Number(battleData.starterWins) || 0,
            opponentWins: Number(battleData.opponentWins) || 0,
            currentRound: Number(battleData.currentRound) || 0,
            status: Number(battleData.status) || 0,
            winner: battleData.winner,
            createdAt: Number(battleData.createdAt) || 0,
          };
          
          // Load card data for thumbnail display
          const cardThumbnails = {};
          const allCards = [...battleState.starterCards, ...battleState.opponentCards];
          for (const cardId of allCards.slice(0, 6)) { // Limit to first 6 cards for performance
            if (cardId && cardId !== "0") {
              try {
                const cardData = await battleCardContract.getCard(cardId);
                cardThumbnails[cardId] = {
                  tokenId: cardId.toString(),
                  power: Number(cardData.power) || 0,
                  defense: Number(cardData.defense) || 0,
                  speed: Number(cardData.speed) || 0,
                  character: Number(cardData.character) || 0,
                  rarity: Number(cardData.rarity) || 0,
                };
              } catch (e) {
                // Skip if card doesn't exist
              }
            }
          }
          
          battleState.cardThumbnails = cardThumbnails;
          history.push(battleState);
        } catch (error) {
          console.error(`Error loading battle ${id}:`, error);
        }
      }
      
      // Sort by createdAt (newest first)
      history.sort((a, b) => b.createdAt - a.createdAt);
      
      // Limit to last 30 battles
      setBattleHistory(history.slice(0, 30));
    } catch (error) {
      console.error("Error loading battle history:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBattleScore = (card) => {
    if (!card) return 0;
    return Number(card.power) + Math.floor(Number(card.defense) / 2) + Number(card.speed);
  };

  if (!account) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Please connect your wallet to battle</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">⚔️ Battle Arena</h1>

      {/* Mode Toggle */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => {
            setMode("create");
            setBattleId("");
            setBattle(null);
            setSelectedCards([]);
            setHistoryMode(false);
          }}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            mode === "create" && !historyMode
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          Create Challenge
        </button>
        <button
          onClick={() => {
            setMode("join");
            setSelectedCards([]);
            setHistoryMode(false);
          }}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            mode === "join" && !historyMode
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          Join Challenge
        </button>
        <button
          onClick={async () => {
            setHistoryMode(true);
            setMode("");
            if (account) {
              await loadBattleHistory();
            }
          }}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            historyMode
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          Battle History
        </button>
      </div>

      {/* Create Battle Mode */}
      {mode === "create" && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Create New Battle</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Opponent Address</label>
              <input
                type="text"
                value={opponentAddress}
                onChange={(e) => setOpponentAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">
                Select 3 Cards ({selectedCards.length}/3)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {userCards.map((card) => (
                  <Card
                    key={card.tokenId}
                    card={card}
                    tokenId={card.tokenId}
                    selected={selectedCards.includes(card.tokenId)}
                    onSelect={() => toggleCardSelection(card.tokenId)}
                    showStats={true}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={createBattle}
              disabled={loading || selectedCards.length !== 3 || !opponentAddress}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Battle"}
            </button>
          </div>
        </div>
      )}

      {/* Join Battle Mode */}
      {mode === "join" && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Join Existing Battle</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Battle ID</label>
              <input
                type="text"
                value={battleId}
                onChange={(e) => setBattleId(e.target.value)}
                placeholder="Enter battle ID"
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              />
              <button
                onClick={loadBattle}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Load Battle
              </button>
            </div>
            {battle && (
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <p className="text-gray-300">
                  <strong>Status:</strong> {BATTLE_STATUS[Number(battle.status)] || `Status ${Number(battle.status)}`}
                </p>
                <p className="text-gray-300">
                  <strong>Starter:</strong> {formatAddress(battle.starter)}
                </p>
                <p className="text-gray-300">
                  <strong>Opponent:</strong> {formatAddress(battle.opponent)}
                </p>
                {Number(battle.status) === 0 && battle.opponent.toLowerCase() === account.toLowerCase() && (
                  <>
                    <div className="mt-4">
                      <label className="block text-gray-300 mb-2">
                        Select Your 3 Cards ({selectedCards.length}/3)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {userCards.map((card) => (
                          <Card
                            key={card.tokenId}
                            card={card}
                            tokenId={card.tokenId}
                            selected={selectedCards.includes(card.tokenId)}
                            onSelect={() => toggleCardSelection(card.tokenId)}
                            showStats={true}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={joinBattle}
                      disabled={loading || selectedCards.length !== 3}
                      className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      {loading ? "Joining..." : "Join Battle"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Battle View - Show when battle status is ReadyToReveal (1), InProgress (2), or Resolved (3) */}
      {!historyMode && battle && battleId && Number(battle.status) >= 1 && Number(battle.status) <= 3 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Battle #{battleId}</h2>
          
          {/* Debug info - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 mb-2">
              Debug: Status={Number(battle.status)}, Round={Number(battle.currentRound)}, 
              StarterWins={Number(battle.starterWins)}, OpponentWins={Number(battle.opponentWins)}
            </div>
          )}
          
          {/* Battle Info */}
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-gray-300 mb-2">
              <strong>Status:</strong> {BATTLE_STATUS[Number(battle.status)] || `Status ${Number(battle.status)}`}
            </p>
            <p className="text-gray-300 mb-2">
              <strong>Current Round:</strong> {Number(battle.currentRound)} / 3
            </p>
          </div>
          
          {/* Battle Cards Grid - Show only revealed round cards */}
          {(() => {
            // When battle is resolved, show all cards
            if (Number(battle.status) === 3) {
              if (Object.keys(battleCards).length === 0) return null;
              return (
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-bold text-white mb-4">All Battle Cards</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Starter Cards */}
                    <div>
                      <p className="text-blue-400 font-semibold mb-2">
                        Starter Cards ({battle.starter.toLowerCase() === account.toLowerCase() ? "You" : formatAddress(battle.starter)})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {battle.starterCards.map((cardId) => {
                          const card = battleCards[cardId];
                          if (!card) return null;
                          return (
                            <Card
                              key={cardId}
                              card={card}
                              tokenId={cardId}
                              showStats={true}
                              onSelect={null}
                            />
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Opponent Cards */}
                    <div>
                      <p className="text-red-400 font-semibold mb-2">
                        Opponent Cards ({battle.opponent.toLowerCase() === account.toLowerCase() ? "You" : formatAddress(battle.opponent)})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {battle.opponentCards.map((cardId) => {
                          const card = battleCards[cardId];
                          if (!card) return null;
                          return (
                            <Card
                              key={cardId}
                              card={card}
                              tokenId={cardId}
                              showStats={true}
                              onSelect={null}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            
            // When no rounds revealed, show placeholder
            if (revealedRounds.length === 0) {
              return (
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">Battle Cards</h3>
                  <p className="text-gray-400 text-sm">
                    Cards will be revealed as rounds progress. Click "Reveal Round" to see which cards are battling.
                  </p>
                </div>
              );
            }
            
            // When rounds are revealed, only show cards from revealed rounds
            const revealedCardIds = new Set();
            revealedRounds.forEach((round) => {
              if (round.starterCard) revealedCardIds.add(round.starterCard);
              if (round.opponentCard) revealedCardIds.add(round.opponentCard);
            });
            
            const revealedStarterCards = battle.starterCards.filter((cardId, index) => {
              // Check if this card was used in any revealed round
              return revealedRounds.some(round => round.round === index);
            });
            
            const revealedOpponentCards = battle.opponentCards.filter((cardId, index) => {
              // Check if this card was used in any revealed round
              return revealedRounds.some(round => round.round === index);
            });
            
            if (revealedCardIds.size === 0) return null;
            
            return (
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-bold text-white mb-4">Revealed Battle Cards</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Starter Cards - Only Revealed */}
                  <div>
                    <p className="text-blue-400 font-semibold mb-2">
                      Starter Cards ({battle.starter.toLowerCase() === account.toLowerCase() ? "You" : formatAddress(battle.starter)})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {revealedRounds.map((round) => {
                        const cardId = battle.starterCards[round.round];
                        const card = battleCards[cardId];
                        if (!card || !cardId || cardId === "0") return null;
                        return (
                          <Card
                            key={`starter-${round.round}`}
                            card={card}
                            tokenId={cardId}
                            showStats={true}
                            onSelect={null}
                          />
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Opponent Cards - Only Revealed */}
                  <div>
                    <p className="text-red-400 font-semibold mb-2">
                      Opponent Cards ({battle.opponent.toLowerCase() === account.toLowerCase() ? "You" : formatAddress(battle.opponent)})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {revealedRounds.map((round) => {
                        const cardId = battle.opponentCards[round.round];
                        const card = battleCards[cardId];
                        if (!card || !cardId || cardId === "0") return null;
                        return (
                          <Card
                            key={`opponent-${round.round}`}
                            card={card}
                            tokenId={cardId}
                            showStats={true}
                            onSelect={null}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Score */}
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <div className="text-center">
                <p className="text-gray-400">Starter</p>
                <p className="text-2xl font-bold text-blue-400">{Number(battle.starterWins)}</p>
              </div>
              <div className="text-gray-500">VS</div>
              <div className="text-center">
                <p className="text-gray-400">Opponent</p>
                <p className="text-2xl font-bold text-red-400">{Number(battle.opponentWins)}</p>
              </div>
            </div>
          </div>

          {/* Round History - Show revealed rounds */}
          {revealedRounds.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-bold text-white mb-3">Round Results</h3>
              <div className="space-y-4">
                {revealedRounds.map((round, idx) => {
                  const starterCard = battleCards[round.starterCard];
                  const opponentCard = battleCards[round.opponentCard];
                  const starterScore = starterCard ? calculateBattleScore(starterCard) : 0;
                  const opponentScore = opponentCard ? calculateBattleScore(opponentCard) : 0;
                  
                  return (
                    <div key={idx} className="border border-gray-700 rounded-lg p-3">
                      <p className="text-white font-semibold mb-2">Round {round.round + 1}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className={`${round.starterWon ? 'ring-2 ring-green-500' : ''}`}>
                          <p className="text-xs text-gray-400 mb-1">Starter Card #{round.starterCard}</p>
                          {starterCard ? (
                            <>
                              <Card card={starterCard} tokenId={round.starterCard} showStats={true} onSelect={null} />
                              <p className="text-xs text-center mt-1 text-gray-400">
                                Score: {starterScore}
                              </p>
                            </>
                          ) : (
                            <div className="bg-gray-800 rounded p-2 text-center text-gray-500">Loading...</div>
                          )}
                        </div>
                        <div className={`${!round.starterWon ? 'ring-2 ring-green-500' : ''}`}>
                          <p className="text-xs text-gray-400 mb-1">Opponent Card #{round.opponentCard}</p>
                          {opponentCard ? (
                            <>
                              <Card card={opponentCard} tokenId={round.opponentCard} showStats={true} onSelect={null} />
                              <p className="text-xs text-center mt-1 text-gray-400">
                                Score: {opponentScore}
                              </p>
                            </>
                          ) : (
                            <div className="bg-gray-800 rounded p-2 text-center text-gray-500">Loading...</div>
                          )}
                        </div>
                      </div>
                      <p className="text-center mt-2 text-sm font-semibold">
                        {round.starterWon ? (
                          <span className="text-blue-400">Starter Wins! 🎉</span>
                        ) : (
                          <span className="text-red-400">Opponent Wins! 🎉</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Round Display (if next round hasn't been revealed) */}
          {Number(battle.status) >= 1 && Number(battle.status) < 3 && Number(battle.currentRound) < 3 && (
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-bold text-white mb-3">
                Next Round: Round {Number(battle.currentRound) + 1}
              </h3>
              <p className="text-gray-400 text-sm mb-3">Click "Reveal Round" to see which cards will battle next.</p>
            </div>
          )}

          {/* Reveal Rounds */}
          {Number(battle.status) < 3 && Number(battle.currentRound) < 3 && (
            <div className="mb-4">
              <button
                onClick={revealRound}
                disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {loading ? "Revealing..." : `Reveal Round ${Number(battle.currentRound) + 1} of 3`}
              </button>
              <p className="text-gray-400 text-sm mt-2">
                Round {Number(battle.currentRound)} of 3 completed
              </p>
            </div>
          )}

          {/* Battle Resolved */}
          {Number(battle.status) === 3 && (
            <div className="bg-gray-900 rounded-lg p-4">
              <p className="text-xl font-bold text-white mb-2">
                {battle.winner.toLowerCase() === account.toLowerCase()
                  ? "🎉 You Won!"
                  : battle.winner === "0x0000000000000000000000000000000000000000"
                  ? "Draw!"
                  : "You Lost"}
              </p>
              {battle.winner.toLowerCase() === account.toLowerCase() && (
                <div className="mt-4">
                  <p className="text-gray-300 mb-3 font-semibold">Select a prize card to claim:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    {battle.opponentCards.map((cardId, index) => {
                      if (!cardId || cardId === "0") return null;
                      const card = battleCards[cardId];
                      if (!card) {
                        return (
                          <div key={index} className="bg-gray-800 rounded-lg p-4 text-center">
                            <p className="text-gray-400">Loading card #{cardId}...</p>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={index}
                          onClick={() => !loading && claimReward(index)}
                          className={`cursor-pointer transition-all ${
                            loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                          }`}
                        >
                          <Card
                            card={card}
                            tokenId={cardId}
                            showStats={true}
                            onSelect={null}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              claimReward(index);
                            }}
                            disabled={loading}
                            className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                          >
                            {loading ? "Claiming..." : "Claim This Card"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await Promise.all([
                          loadUserCards(),
                          loadBattle()
                        ]);
                        alert("Cards refreshed!");
                      } catch (error) {
                        console.error("Error refreshing cards:", error);
                        alert("Failed to refresh cards");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:bg-gray-600"
                  >
                    {loading ? "Refreshing..." : "Refresh Cards"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Battle History Mode */}
      {historyMode && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Battle History</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setHistoryFilter("all")}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  historyFilter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setHistoryFilter("wins")}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  historyFilter === "wins"
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                My Wins
              </button>
              <button
                onClick={() => setHistoryFilter("losses")}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  historyFilter === "losses"
                    ? "bg-red-600 text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                My Losses
              </button>
            </div>
          </div>

          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-400">Loading battle history...</p>
            </div>
          )}

          {!loading && battleHistory.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400">No battle history found.</p>
            </div>
          )}

          {!loading && battleHistory.length > 0 && (
            <div className="space-y-4">
              {battleHistory
                .filter((battle) => {
                  if (historyFilter === "all") return true;
                  if (historyFilter === "wins") {
                    return battle.winner.toLowerCase() === account.toLowerCase();
                  }
                  if (historyFilter === "losses") {
                    const isStarter = battle.starter.toLowerCase() === account.toLowerCase();
                    const isOpponent = battle.opponent.toLowerCase() === account.toLowerCase();
                    return (
                      (isStarter || isOpponent) &&
                      battle.winner.toLowerCase() !== account.toLowerCase() &&
                      battle.winner !== "0x0000000000000000000000000000000000000000"
                    );
                  }
                  return true;
                })
                .map((battle) => {
                  const isStarter = battle.starter.toLowerCase() === account.toLowerCase();
                  const isOpponent = battle.opponent.toLowerCase() === account.toLowerCase();
                  const opponentAddress = isStarter ? battle.opponent : battle.starter;
                  const isWinner = battle.winner.toLowerCase() === account.toLowerCase();
                  const isDraw = battle.winner === "0x0000000000000000000000000000000000000000";

                  return (
                    <div
                      key={battle.battleId}
                      onClick={() => {
                        setHistoryMode(false);
                        setMode("");
                        setBattleId(battle.battleId);
                        setBattle(battle);
                        loadBattle();
                      }}
                      className="bg-gray-900 rounded-lg p-4 cursor-pointer hover:bg-gray-800 transition-colors border border-gray-700"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            Battle #{battle.battleId}
                          </h3>
                          <p className="text-sm text-gray-400">
                            Opponent: {formatAddress(opponentAddress)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Block: {battle.createdAt}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              isWinner
                                ? "bg-green-600 text-white"
                                : isDraw
                                ? "bg-yellow-600 text-white"
                                : "bg-red-600 text-white"
                            }`}
                          >
                            {isWinner ? "Win" : isDraw ? "Draw" : "Loss"}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            {BATTLE_STATUS[battle.status] || `Status ${battle.status}`}
                          </p>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex items-center justify-center gap-4 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Starter</p>
                          <p className="text-xl font-bold text-blue-400">{battle.starterWins}</p>
                        </div>
                        <div className="text-gray-500">VS</div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Opponent</p>
                          <p className="text-xl font-bold text-red-400">{battle.opponentWins}</p>
                        </div>
                      </div>

                      {/* Card Thumbnails */}
                      {battle.cardThumbnails && Object.keys(battle.cardThumbnails).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <p className="text-xs text-gray-400 mb-2">Cards Used:</p>
                          <div className="grid grid-cols-6 gap-2">
                            {[...battle.starterCards, ...battle.opponentCards].map((cardId) => {
                              if (!cardId || cardId === "0") return null;
                              const card = battle.cardThumbnails[cardId];
                              if (!card) return null;
                              return (
                                <Card
                                  key={cardId}
                                  card={card}
                                  tokenId={cardId}
                                  showStats={false}
                                  onSelect={null}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-gray-500 mt-3 text-center">
                        Click to view battle details
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
