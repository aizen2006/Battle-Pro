import { ethers } from "ethers";

// Normalize addresses - convert to string and checksum
function normalizeAddress(address) {
    if (!address || address.length === 0) return "";
    
    // Force convert to string and trim whitespace
    let addr = String(address).trim();
    
    // Remove quotes if present
    if (addr.startsWith('"') && addr.endsWith('"')) {
        addr = addr.slice(1, -1);
    }
    if (addr.startsWith("'") && addr.endsWith("'")) {
        addr = addr.slice(1, -1);
    }
    
    // Ensure it starts with 0x
    if (!addr.startsWith('0x')) {
        addr = '0x' + addr;
    }
    
    // If address is 41 chars, try adding leading zero
    if (addr.length === 41 && addr.startsWith('0x')) {
        addr = '0x0' + addr.slice(2);
    }
    
    // Validate and checksum using ethers
    try {
        // First check if it's a valid address format
        if (!ethers.isAddress(addr)) {
            console.warn("Invalid address format:", addr);
            return addr; // Return as-is if not valid
        }
        // Get checksummed version
        return ethers.getAddress(addr);
    } catch (e) {
        console.warn("Address normalization failed:", addr, e.message);
        return addr; // Return as-is if checksumming fails
    }
}

const conf = {
    battleCardAddress: normalizeAddress(import.meta.env.VITE_BATTLE_CARD_ADDRESS || ""),
    battleManagerAddress: normalizeAddress(import.meta.env.VITE_BATTLE_MANAGER_ADDRESS || ""),
};

export default conf;
