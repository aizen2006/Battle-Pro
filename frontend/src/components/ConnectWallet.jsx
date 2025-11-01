import React from "react";
import { connectWallet } from "../lib/ethereum";

export default function ConnectWallet({ onConnect, account }) {
  const handleConnect = async () => {
    try {
      const address = await connectWallet();
      if (onConnect) onConnect(address);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      alert(`Failed to connect wallet: ${error.message}`);
    }
  };

  if (account) {
    return (
      <div className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold">
        ✓ Connected: {account.slice(0, 6)}...{account.slice(-4)}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
    >
      Connect Wallet
    </button>
  );
}
