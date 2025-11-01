// Debug script for browser console
// Copy and paste this entire block into your browser console

(async () => {
  try {
    if (!window.ethereum) {
      console.error("❌ MetaMask not found");
      return;
    }

    // Get ethers from the app (already loaded)
    const { ethers } = window.ethers || await import('ethers');
    
    // Get signer
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    
    console.log("🔍 Your address:", signerAddress);
    
    // Get contract addresses from your .env file
    // You can find these in frontend/.env
    const BATTLE_CARD_ADDRESS = "0x2E83fe90C756C0240a74412D750A6a1374112C08"; // Replace with your actual address
    const BATTLE_MANAGER_ADDRESS = "0x9e140d775e0bD94b082Fb396Fb501Cb57d557523"; // Replace with your actual address
    
    console.log("📋 Battle Card Contract:", BATTLE_CARD_ADDRESS);
    console.log("⚔️ Battle Manager Contract:", BATTLE_MANAGER_ADDRESS);
    
    // Simple ABI for ownerOf
    const abi = ["function ownerOf(uint256 tokenId) external view returns (address)"];
    const contract = new ethers.Contract(BATTLE_CARD_ADDRESS, abi, signer);
    
    // Check cards 1, 2, 3
    console.log("\n📊 Checking card ownership...\n");
    for (let i = 1; i <= 3; i++) {
      try {
        const owner = await contract.ownerOf(i);
        const ownerLower = owner.toLowerCase();
        const signerLower = signerAddress.toLowerCase();
        const managerLower = BATTLE_MANAGER_ADDRESS.toLowerCase();
        
        console.log(`🎴 Card #${i}:`);
        console.log(`   Owner: ${owner}`);
        console.log(`   Your address: ${signerAddress}`);
        console.log(`   Match with you: ${ownerLower === signerLower ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is in BattleManager: ${ownerLower === managerLower ? '⚔️ YES (in battle)' : '❌ NO'}`);
        
        if (ownerLower === managerLower) {
          console.log(`   ⚠️ Card #${i} is currently in an active battle (escrowed)`);
        } else if (ownerLower !== signerLower) {
          console.log(`   ⚠️ Card #${i} is owned by someone else`);
        } else {
          console.log(`   ✅ Card #${i} is owned by you`);
        }
        console.log("");
      } catch (e) {
        console.log(`❌ Card #${i}: Error - ${e.message}`);
        console.log("");
      }
    }
    
    console.log("✅ Done checking cards!");
  } catch (e) {
    console.error("❌ Error:", e);
  }
})();

