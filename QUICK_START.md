# 🚀 Quick Start Checklist

## Pre-Deployment Setup

1. ✅ Install dependencies:
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

2. ✅ Create `.env` file in root:
   ```
   PRIVATE_KEY=your_private_key_here
   ```

3. ✅ Compile contracts:
   ```bash
   npx hardhat compile
   ```

## Deployment

4. ✅ Deploy to Monad Blitz testnet:
   ```bash
   npx hardhat run script/deploy.js --network monad
   ```

5. ✅ Copy deployed addresses to `frontend/.env`:
   ```
   VITE_BATTLE_CARD_ADDRESS=0x...
   VITE_BATTLE_MANAGER_ADDRESS=0x...
   ```

## MetaMask Setup

6. ✅ Add Monad Blitz network to MetaMask:
   - Network Name: Monad Blitz Testnet
   - RPC URL: https://rpc.blitz.monad.xyz
   - Chain ID: 10143
   - Currency Symbol: MON

7. ✅ Get testnet MON from faucet

## Run Frontend

8. ✅ Start development server:
   ```bash
   cd frontend
   npm run dev
   ```

9. ✅ Open http://localhost:5173

## Testing (Optional)

10. ✅ Run tests:
    ```bash
    npx hardhat test
    ```

## Usage Flow

1. Connect wallet (MetaMask on Monad Blitz)
2. Go to Home page
3. Click "Generate Card — 0.001 MON"
4. View your collection on Collection page
5. Create/join battles on Battle page

---

**Note:** Make sure contracts are deployed before running the frontend!
