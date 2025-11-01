import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import ConnectWallet from "./components/ConnectWallet";
import Collection from "./pages/Collection";
import Battle from "./pages/Battle";
import Home from "./pages/Home";
import { getProvider } from "./lib/ethereum";

function App() {
  const [account, setAccount] = useState("");

  useEffect(() => {
    checkConnection();
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = getProvider();
        if (provider) {
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0].address);
          }
        }
      } catch (error) {
        console.error("Error checking connection:", error);
      }
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount("");
    } else {
      setAccount(accounts[0]);
    }
  };

  const handleConnect = (address) => {
    setAccount(address);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Nav account={account} onConnect={handleConnect} />
        <Routes>
          <Route path="/" element={<Home account={account} />} />
          <Route path="/collection" element={<Collection account={account} />} />
          <Route path="/battle" element={<Battle account={account} />} />
        </Routes>
      </div>
    </Router>
  );
}

function Nav({ account, onConnect }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-gray-900 border-b border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-white">
            ⚔️ Monad Battle Cards
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isActive("/")
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Home
            </Link>
            <Link
              to="/collection"
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isActive("/collection")
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Collection
            </Link>
            <Link
              to="/battle"
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isActive("/battle")
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Battle
            </Link>
            <ConnectWallet account={account} onConnect={onConnect} />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default App;