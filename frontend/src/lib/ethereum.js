import { ethers } from "ethers";
import conf from "./conf.js";

// Helper to safely checksum an address
function getChecksummedAddress(address) {
  if (!address || address.length === 0) return "";
  try {
    if (ethers.isAddress(address)) {
      return ethers.getAddress(String(address).trim());
    }
    return String(address).trim();
  } catch (e) {
    console.warn("Failed to checksum address:", address, e.message);
    return String(address).trim();
  }
}

// Contract addresses - ensure they're checksummed
// The addresses from conf.js should already be checksummed, but we ensure it here too
export const BATTLE_CARD_ADDRESS = getChecksummedAddress(conf.battleCardAddress);
export const BATTLE_MANAGER_ADDRESS = getChecksummedAddress(conf.battleManagerAddress);

// Monad Blitz testnet configuration
export const MONAD_BLITZ = {
  chainId: "0x279F", // 10143 in hex
  chainName: "Monad Blitz Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://explorer.blitz.monad.xyz"],
};

// Contract ABIs (minimal for MVP)
export const BATTLE_CARD_ABI = [
  "function mintCard() external payable returns (uint256)",
  "function getCard(uint256 tokenId) external view returns (tuple(uint16 power, uint16 defense, uint16 speed, uint8 character, uint8 rarity))",
  "function getOwnedTokens(address owner) external view returns (uint256[])",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) external view returns (address)",
  "function batchApprove(address to, uint256[] calldata tokenIds) external",
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function nextId() external view returns (uint256)",
  "event CardMinted(address indexed owner, uint256 indexed tokenId, uint8 character, uint8 rarity, uint16 power, uint16 defense, uint16 speed)",
];

export const BATTLE_MANAGER_ABI = [
  "function createBattle(address opponent, uint256[3] calldata myCards) external returns (uint256)",
  "function joinBattle(uint256 battleId, uint256[3] calldata opponentCards) external",
  "function revealRound(uint256 battleId) external",
  "function claimReward(uint256 battleId, uint8 prizeCardIndex) external",
  "function cancelBattle(uint256 battleId) external",
  "function getBattle(uint256 battleId) external view returns (tuple(address starter, address opponent, uint256[3] starterCards, uint256[3] opponentCards, uint8 starterWins, uint8 opponentWins, uint8 currentRound, uint8 status, uint256 createdAt, address winner))",
  "function battleCard() external view returns (address)",
  "event BattleCreated(uint256 indexed battleId, address indexed starter, address indexed opponent, uint256[3] starterCards)",
  "event BattleJoined(uint256 indexed battleId, address indexed opponent, uint256[3] opponentCards)",
  "event RoundResolved(uint256 indexed battleId, uint8 indexed roundIndex, uint256 starterCardId, uint256 opponentCardId, bool starterWon)",
  "event BattleResolved(uint256 indexed battleId, address indexed winner)",
  "event CardClaimed(uint256 indexed battleId, address indexed winner, uint256 indexed claimedTokenId)",
];

// Helper to get provider
export const getProvider = () => {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  return null;
};

// Helper to get signer
export const getSigner = async () => {
  const provider = getProvider();
  if (!provider) return null;
  return await provider.getSigner();
};

// Helper to get contracts
export const getBattleCardContract = async () => {
  const signer = await getSigner();
  if (!signer || !BATTLE_CARD_ADDRESS) return null;
  
  try {
    // Ensure address is checksummed (EIP-55 format)
    const checksummedAddress = ethers.getAddress(String(BATTLE_CARD_ADDRESS).trim());
    return new ethers.Contract(checksummedAddress, BATTLE_CARD_ABI, signer);
  } catch (e) {
    console.error("Failed to checksum Battle Card address:", e.message);
    return null;
  }
};

export const getBattleManagerContract = async () => {
  const signer = await getSigner();
  if (!signer || !BATTLE_MANAGER_ADDRESS) return null;
  
  try {
    // Ensure address is checksummed (EIP-55 format)
    const checksummedAddress = ethers.getAddress(String(BATTLE_MANAGER_ADDRESS).trim());
    return new ethers.Contract(checksummedAddress, BATTLE_MANAGER_ABI, signer);
  } catch (e) {
    console.error("Failed to checksum Battle Manager address:", e.message);
    return null;
  }
};

// Helper to check/add Monad Blitz network
export const addMonadBlitzNetwork = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [MONAD_BLITZ],
    });
  } catch (error) {
    if (error.code === 4902) {
      // Chain already added
      console.log("Monad Blitz network already added");
    } else {
      throw error;
    }
  }

  // Switch to Monad Blitz
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: MONAD_BLITZ.chainId }],
  });
};

// Helper to connect wallet
export const connectWallet = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  try {
    // Add/switch to Monad Blitz
    await addMonadBlitzNetwork();

    // Request account access
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    return accounts[0];
  } catch (error) {
    console.error("Error connecting wallet:", error);
    throw error;
  }
};

// Helper to format address
export const formatAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
