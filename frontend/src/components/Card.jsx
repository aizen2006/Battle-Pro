import React from "react";

const CHARACTER_NAMES = ["Warrior", "Mage", "Cavalry", "Prince"];
const RARITY_NAMES = ["Common", "Rare", "Epic", "Legendary", "Mythic"];
const RARITY_COLORS = {
  0: "bg-gray-500",      // Common
  1: "bg-blue-500",      // Rare
  2: "bg-purple-500",    // Epic
  3: "bg-yellow-500",    // Legendary
  4: "bg-red-600",       // Mythic
};

const RARITY_TEXT_COLORS = {
  0: "text-gray-100",
  1: "text-blue-100",
  2: "text-purple-100",
  3: "text-yellow-100",
  4: "text-red-100",
};

export default function Card({ card, tokenId, selected = false, onSelect, showStats = true }) {
  if (!card) return null;

  // Safely extract and convert values to numbers
  const power = Number(card.power) || 0;
  const defense = Number(card.defense) || 0;
  const speed = Number(card.speed) || 0;
  const character = Number(card.character) || 0;
  const rarity = Number(card.rarity) || 0;
  
  const characterName = CHARACTER_NAMES[character] || "Unknown";
  const rarityName = RARITY_NAMES[rarity] || "Unknown";
  const rarityColor = RARITY_COLORS[rarity] || "bg-gray-500";
  const rarityTextColor = RARITY_TEXT_COLORS[rarity] || "text-gray-100";

  const totalScore = power + defense + speed;

  return (
    <div
      className={`relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 shadow-lg border-2 transition-all cursor-pointer ${
        selected ? "border-yellow-400 ring-4 ring-yellow-400/50" : "border-gray-700 hover:border-gray-600"
      }`}
      onClick={onSelect}
    >
      {/* Rarity Badge */}
      <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${rarityColor} ${rarityTextColor}`}>
        {rarityName}
      </div>

      {/* Card Content */}
      <div className="mt-6">
        {/* Character Icon/Name */}
        <div className="text-center mb-4">
          <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-4xl">
            {character === 0 && "⚔️"}
            {character === 1 && "🔮"}
            {character === 2 && "🐴"}
            {character === 3 && "👑"}
            {characterName === "Unknown" && "❓"}
          </div>
          <h3 className="text-lg font-bold text-white">{characterName}</h3>
          {tokenId && <p className="text-xs text-gray-400">ID: {tokenId}</p>}
        </div>

        {showStats && (
          <>
            {/* Stats */}
            <div className="space-y-3">
              <StatBar label="Power" value={power} max={300} color="bg-red-500" />
              <StatBar label="Defense" value={defense} max={250} color="bg-blue-500" />
              <StatBar label="Speed" value={speed} max={150} color="bg-green-500" />
            </div>

            {/* Total Score */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-center text-sm text-gray-400">
                Total Score: <span className="text-yellow-400 font-bold">{totalScore}</span>
              </p>
            </div>
          </>
        )}

        {/* Selection Checkbox */}
        {onSelect && (
          <div className="absolute top-2 left-2">
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selected
                  ? "bg-yellow-400 border-yellow-400"
                  : "bg-transparent border-gray-600"
              }`}
            >
              {selected && <span className="text-black text-xs">✓</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }) {
  const percentage = Math.min((Number(value) / max) * 100, 100);

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-semibold">{value}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
