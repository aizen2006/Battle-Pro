import React, { useState, useEffect } from "react";
import Card from "../components/Card";
import { getBattleCardContract, getProvider } from "../lib/ethereum";

export default function Collection({ account }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCards, setSelectedCards] = useState(new Set());

  useEffect(() => {
    if (account) {
      loadCards();
    }
  }, [account]);

  const loadCards = async () => {
    if (!account) return;
    setLoading(true);
    try {
      const contract = await getBattleCardContract();
      if (!contract) {
        console.error("Contract not available");
        return;
      }

      // Get signer address (the one making transactions)
      const { getProvider } = await import("../lib/ethereum");
      const provider = getProvider();
      if (!provider) {
        console.error("Provider not available");
        return;
      }

      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const signerLower = signerAddress.toLowerCase();

      // Get balance first
      const balance = await contract.balanceOf(signerAddress);
      console.log(`📊 Your balance: ${balance.toString()} cards`);

      if (Number(balance) === 0) {
        setCards([]);
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
      }

      console.log(`✅ Loaded ${ownedCards.length} cards you actually own (verified via ownerOf)`);
      setCards(ownedCards);
    } catch (error) {
      console.error("Error loading cards:", error);
      alert("Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const toggleCardSelection = (tokenId) => {
    const newSelection = new Set(selectedCards);
    if (newSelection.has(tokenId)) {
      newSelection.delete(tokenId);
    } else {
      if (newSelection.size >= 3) {
        alert("You can only select up to 3 cards for battle");
        return;
      }
      newSelection.add(tokenId);
    }
    setSelectedCards(newSelection);
  };

  if (!account) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Please connect your wallet to view your collection</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">My Collection</h1>
        <button
          onClick={loadCards}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <p className="text-gray-400">Loading your cards...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">You don't have any cards yet!</p>
          <p className="text-gray-500 mt-2">Go to the home page to mint your first card.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-gray-300">
            Selected: {selectedCards.size}/3 cards
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {cards.map((card) => (
              <Card
                key={card.tokenId}
                card={card}
                tokenId={card.tokenId}
                selected={selectedCards.has(card.tokenId)}
                onSelect={() => toggleCardSelection(card.tokenId)}
                showStats={true}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
