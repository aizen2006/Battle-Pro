import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import Card from "../components/Card";
import ConnectionStatus from "../components/ConnectionStatus";
import { getBattleCardContract } from "../lib/ethereum";

export default function Home({ account }) {
  const [loading, setLoading] = useState(false);
  const [newCard, setNewCard] = useState(null);
  const navigate = useNavigate();

  const mintCard = async () => {
    if (!account) {
      alert("Please connect your wallet first");
      return;
    }

    setLoading(true);
    try {
      const contract = await getBattleCardContract();
      if (!contract) {
        throw new Error("Contract not available. Make sure contracts are deployed.");
      }

      const mintFee = ethers.parseEther("0.001");
      const tx = await contract.mintCard({ value: mintFee });
      console.log("Minting transaction:", tx.hash);
      
      // Wait for transaction
      const receipt = await tx.wait();
      
      // Find CardMinted event to get token ID
      const event = receipt.logs.find(
        (log) =>
          log.topics[0] === contract.interface.getEvent("CardMinted").topicHash
      );

      if (event) {
        const parsed = contract.interface.parseLog(event);
        const tokenId = parsed.args.tokenId;
        
        // Fetch card data
        const cardData = await contract.getCard(tokenId);
        // Convert BigInt values to numbers for display
        setNewCard({
          tokenId: tokenId.toString(),
          power: Number(cardData.power) || 0,
          defense: Number(cardData.defense) || 0,
          speed: Number(cardData.speed) || 0,
          character: Number(cardData.character) || 0,
          rarity: Number(cardData.rarity) || 0,
        });
        
        alert(`✅ Card #${tokenId} minted successfully!`);
      } else {
        // Fallback: try to get the latest token ID
        const nextId = await contract.nextId();
        const tokenId = nextId - 1n;
        const cardData = await contract.getCard(tokenId);
        // Convert BigInt values to numbers for display
        setNewCard({
          tokenId: tokenId.toString(),
          power: Number(cardData.power) || 0,
          defense: Number(cardData.defense) || 0,
          speed: Number(cardData.speed) || 0,
          character: Number(cardData.character) || 0,
          rarity: Number(cardData.rarity) || 0,
        });
        alert(`✅ Card #${tokenId} minted successfully!`);
      }
    } catch (error) {
      console.error("Error minting card:", error);
      alert(`Failed to mint card: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4">
          ⚔️ Monad Battle Cards
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Collect, battle, and win legendary NFT cards on Monad
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Connection Status */}
        <div className="mb-6">
          <ConnectionStatus />
        </div>

        {/* Mint Section */}
        <div className="bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            🎴 Generate Your Battle Card
          </h2>
          <p className="text-gray-300 text-center mb-6">
            Pay <span className="text-yellow-400 font-bold">0.001 MON</span> to mint a randomly-generated
            battle card with unique stats and rarity!
          </p>

          {!account ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Please connect your wallet to mint a card</p>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={mintCard}
                disabled={loading}
                className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-lg text-lg shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⚙️</span>
                    Minting...
                  </span>
                ) : (
                  "🎴 Generate Card — 0.001 MON"
                )}
              </button>
            </div>
          )}

          {/* Newly Minted Card */}
          {newCard && (
            <div className="mt-8">
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4">
                <p className="text-green-400 font-semibold text-center">
                  ✨ New Card Minted! ✨
                </p>
              </div>
              <div className="flex justify-center">
                <div className="w-full max-w-sm">
                  <Card card={newCard} tokenId={newCard.tokenId} showStats={true} />
                </div>
              </div>
              <div className="mt-6 text-center">
                <button
                  onClick={() => navigate("/collection")}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold mr-4"
                >
                  View Collection
                </button>
                <button
                  onClick={() => {
                    setNewCard(null);
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold"
                >
                  Mint Another
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-2">🎲 Random Generation</h3>
            <p className="text-gray-300 text-sm">
              Each card has randomly generated stats, character type, and rarity based on on-chain
              randomness.
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-2">⚔️ Battle System</h3>
            <p className="text-gray-300 text-sm">
              Challenge other players in best-of-3 battles. Winners claim opponent cards as prizes!
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-2">💎 Rarity Tiers</h3>
            <p className="text-gray-300 text-sm">
              Common, Rare, Epic, Legendary, and Mythic cards with progressively better stats.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
