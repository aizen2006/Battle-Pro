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
      setBattle({
        starter: battleData.starter,
        opponent: battleData.opponent,
        starterCards: battleData.starterCards.map((id) => id.toString()),
        opponentCards: battleData.opponentCards.map((id) => id.toString()),
        starterWins: Number(battleData.starterWins) || 0,
        opponentWins: Number(battleData.opponentWins) || 0,
        currentRound: Number(battleData.currentRound) || 0,
        status: Number(battleData.status) || 0,
        winner: battleData.winner,
      });
    } catch (error) {
      console.error("Error loading battle:", error);
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
      
      // Wait a bit for blockchain state to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh battle state and user cards - await both to ensure they complete
      await Promise.all([
        loadBattle(),
        loadUserCards()
      ]);
      
      // Hide the claim buttons by clearing the battle view or updating state
      // The battle status should remain resolved, but cards should be returned
      alert("Reward claimed successfully! Your cards have been updated.");
    } catch (error) {
      console.error("Error claiming reward:", error);
      alert(`Failed to claim reward: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
          }}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            mode === "create"
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
          }}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            mode === "join"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          Join Challenge
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
      {battle && battleId && Number(battle.status) >= 1 && Number(battle.status) <= 3 && (
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
                  <p className="text-gray-300 mb-2">Select a prize card:</p>
                  <div className="flex gap-2 mb-4">
                    {[0, 1, 2].map((index) => (
                      <button
                        key={index}
                        onClick={() => claimReward(index)}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:bg-gray-600"
                      >
                        Claim Card {index + 1}
                      </button>
                    ))}
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
    </div>
  );
}
