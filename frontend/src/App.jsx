import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css";

// 👉 Replace this with your deployed address
const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";

// 👉 Paste ABI of BattleCard.sol here
const CONTRACT_ABI = [
  // Mint
  "function mintCard() external",
  // Battle
  "function battle(uint256 card1, uint256 card2) external view returns (string)",
  // Upgrade
  "function upgrade(uint256 id1, uint256 id2) external",
  // Getter
  "function getCard(uint256 tokenId) external view returns (tuple(uint256 power,uint256 defense,uint256 speed,uint8 rarity))",
  // Next ID
  "function nextId() view returns (uint256)"
];

function App() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);

  const [tokenId, setTokenId] = useState("");
  const [card, setCard] = useState(null);
  const [battleIds, setBattleIds] = useState({ id1: "", id2: "" });
  const [battleResult, setBattleResult] = useState("");
  const [upgradeIds, setUpgradeIds] = useState({ id1: "", id2: "" });

  // --- Connect Wallet ---
  const connectWallet = async () => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setProvider(provider);
      setContract(contract);
      setAccount(accounts[0]);
    } else {
      alert("MetaMask not detected");
    }
  };

  // --- Mint a new Card ---
  const mintCard = async () => {
    if (!contract) return;
    const tx = await contract.mintCard();
    await tx.wait();
    alert("✅ Card Minted!");
  };

  // --- Fetch Card Attributes ---
  const fetchCard = async () => {
    if (!contract || !tokenId) return;
    try {
      const result = await contract.getCard(tokenId);
      setCard({
        power: result.power.toString(),
        defense: result.defense.toString(),
        speed: result.speed.toString(),
        rarity: result.rarity.toString()
      });
    } catch (err) {
      console.error(err);
      alert("Card not found!");
    }
  };

  // --- Battle Function ---
  const handleBattle = async () => {
    if (!contract || !battleIds.id1 || !battleIds.id2) return;
    const result = await contract.battle(battleIds.id1, battleIds.id2);
    setBattleResult(result);
  };

  // --- Upgrade Function ---
  const handleUpgrade = async () => {
    if (!contract) return;
    const tx = await contract.upgrade(upgradeIds.id1, upgradeIds.id2);
    await tx.wait();
    alert("⚡ Upgrade Complete! New card minted.");
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>⚔️ Monad NFT Battle Cards</h1>
        {!account ? (
          <button onClick={connectWallet}>Connect Wallet</button>
        ) : (
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
        )}

        <div className="card-section">
          <h2>🎴 Mint Your Battle Card</h2>
          <button onClick={mintCard}>Mint Card</button>
        </div>

        <div className="fetch-section">
          <h2>🔍 View Card Attributes</h2>
          <input
            placeholder="Enter Card ID"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
          <button onClick={fetchCard}>Fetch</button>
          {card && (
            <div className="card-box">
              <p>Power: {card.power}</p>
              <p>Defense: {card.defense}</p>
              <p>Speed: {card.speed}</p>
              <p>Rarity: {card.rarity}⭐</p>
            </div>
          )}
        </div>

        <div className="battle-section">
          <h2>⚔️ Battle Arena</h2>
          <input
            placeholder="Card 1 ID"
            value={battleIds.id1}
            onChange={(e) => setBattleIds({ ...battleIds, id1: e.target.value })}
          />
          <input
            placeholder="Card 2 ID"
            value={battleIds.id2}
            onChange={(e) => setBattleIds({ ...battleIds, id2: e.target.value })}
          />
          <button onClick={handleBattle}>Start Battle</button>
          {battleResult && <p className="result">{battleResult}</p>}
        </div>

        <div className="upgrade-section">
          <h2>🔥 Upgrade Cards</h2>
          <input
            placeholder="Card 1 ID"
            value={upgradeIds.id1}
            onChange={(e) => setUpgradeIds({ ...upgradeIds, id1: e.target.value })}
          />
          <input
            placeholder="Card 2 ID"
            value={upgradeIds.id2}
            onChange={(e) => setUpgradeIds({ ...upgradeIds, id2: e.target.value })}
          />
          <button onClick={handleUpgrade}>Upgrade</button>
        </div>
      </header>
    </div>
  );
}

export default App;
