import React, { useState, useEffect } from "react";
import { 
  BATTLE_CARD_ADDRESS, 
  BATTLE_MANAGER_ADDRESS,
  getBattleCardContract,
  getBattleManagerContract,
  getProvider
} from "../lib/ethereum";
import { ethers } from "ethers";

export default function ConnectionStatus() {
  const [status, setStatus] = useState({
    envVars: false,
    contracts: false,
    network: false,
    error: null
  });

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const newStatus = {
      envVars: false,
      contracts: false,
      network: false,
      error: null
    };

    try {
      // Check environment variables (Ethereum addresses are 42 chars: 0x + 40 hex chars)
      // But also accept 41 chars in case of missing leading zero (ethers.getAddress will fix it)
      const hasCardAddress = !!BATTLE_CARD_ADDRESS && BATTLE_CARD_ADDRESS.length >= 41;
      const hasManagerAddress = !!BATTLE_MANAGER_ADDRESS && BATTLE_MANAGER_ADDRESS.length >= 41;
      newStatus.envVars = hasCardAddress && hasManagerAddress;

      if (!newStatus.envVars) {
        newStatus.error = "Environment variables not properly configured";
        setStatus(newStatus);
        return;
      }

      // Check contract addresses format and prepare checksummed addresses
      let checksummedCardAddr = "";
      let checksummedManagerAddr = "";
      
      try {
        // Ensure addresses are strings and validate them
        const cardAddr = String(BATTLE_CARD_ADDRESS || "").trim();
        const managerAddr = String(BATTLE_MANAGER_ADDRESS || "").trim();
        
        let cardValid = false;
        let managerValid = false;
        
        try {
          if (cardAddr && cardAddr.length >= 40) {
            // Use isAddress first, then getAddress for checksum
            if (ethers.isAddress(cardAddr)) {
              checksummedCardAddr = ethers.getAddress(cardAddr); // Get checksummed version
              cardValid = true;
            }
          }
        } catch (e) {
          console.error("Card address validation failed:", cardAddr, e.message);
        }
        
        try {
          if (managerAddr && managerAddr.length >= 40) {
            if (ethers.isAddress(managerAddr)) {
              checksummedManagerAddr = ethers.getAddress(managerAddr); // Get checksummed version
              managerValid = true;
            }
          }
        } catch (e) {
          console.error("Manager address validation failed:", managerAddr, e.message);
        }
        
        if (!cardValid || !managerValid) {
          throw new Error(
            !cardValid 
              ? `Invalid Battle Card address: ${cardAddr} (length: ${cardAddr?.length})` 
              : `Invalid Battle Manager address: ${managerAddr} (length: ${managerAddr?.length})`
          );
        }
      } catch (e) {
        newStatus.error = `Invalid contract address format: ${e.message}`;
        setStatus(newStatus);
        return;
      }

      // Check if contracts can be initialized
      try {
        const provider = getProvider();
        if (provider) {
          // Use checksummed addresses
          
          // Try to get code at addresses (using checksummed addresses)
          const cardCode = await provider.getCode(checksummedCardAddr);
          const managerCode = await provider.getCode(checksummedManagerAddr);
          
          newStatus.contracts = cardCode !== "0x" && managerCode !== "0x";
          
          if (!newStatus.contracts) {
            newStatus.error = "Contracts not found at addresses (not deployed?)";
          }
        } else {
          newStatus.error = "Provider not available (MetaMask not connected)";
        }
      } catch (e) {
        newStatus.error = `Contract check failed: ${e.message}`;
      }

      // Check network (if wallet connected)
      try {
        if (window.ethereum) {
          const chainId = await window.ethereum.request({ method: "eth_chainId" });
          newStatus.network = chainId === "0x279F" || chainId === "0x279f"; // Monad Blitz
        }
      } catch (e) {
        // Not connected to wallet, network check skipped
      }

    } catch (error) {
      newStatus.error = error.message;
    }

    setStatus(newStatus);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-4">🔌 Connection Status</h2>
      
      <div className="space-y-3">
        {/* Environment Variables */}
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Environment Variables</span>
          <span className={status.envVars ? "text-green-400" : "text-red-400"}>
            {status.envVars ? "✓ Configured" : "✗ Not Configured"}
          </span>
        </div>
        
        {status.envVars && (
          <>
            <div className="text-xs text-gray-400 pl-4">
              Card: {BATTLE_CARD_ADDRESS.slice(0, 6)}...{BATTLE_CARD_ADDRESS.slice(-4)}
            </div>
            <div className="text-xs text-gray-400 pl-4">
              Manager: {BATTLE_MANAGER_ADDRESS.slice(0, 6)}...{BATTLE_MANAGER_ADDRESS.slice(-4)}
            </div>
          </>
        )}

        {/* Contracts */}
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Contracts Deployed</span>
          <span className={status.contracts ? "text-green-400" : "text-yellow-400"}>
            {status.contracts ? "✓ Found" : "⚠ Not Found"}
          </span>
        </div>

        {/* Network */}
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Network (Monad Blitz)</span>
          <span className={status.network ? "text-green-400" : "text-yellow-400"}>
            {status.network ? "✓ Connected" : "⚠ Not Connected"}
          </span>
        </div>

        {/* Error Message */}
        {status.error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-300 text-sm">
            ⚠ {status.error}
          </div>
        )}

        {/* Success Message */}
        {status.envVars && status.contracts && !status.error && (
          <div className="mt-4 p-3 bg-green-500/20 border border-green-500 rounded text-green-300 text-sm">
            ✅ All systems connected! Ready to mint and battle!
          </div>
        )}
      </div>

      <button
        onClick={checkConnection}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
      >
        Refresh Status
      </button>
    </div>
  );
}
